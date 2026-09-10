import ActiveTrip from '@/components/active-trip';
import RouteMap from '@/components/route-map';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Library, readLibrary, RouteResult, SavedRoute, searchRoutes, storageKey, validate } from '@/lib/routes';

type Tab = 'Planejar' | 'Favoritos' | 'Histórico';
function Button({ title, onPress, secondary = false, disabled = false }: { title: string; onPress: () => void; secondary?: boolean; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && { opacity: 0.5 }]}><Text style={[styles.buttonText, secondary && { color: '#6D38C3' }]}>{title}</Text></Pressable>;
}
export default function HomeScreen() {
  const [tab, setTab] = useState<Tab>('Planejar');
  const [origin, setOrigin] = useState('');
  const [stops, setStops] = useState(['']);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [completed, setCompleted] = useState(0);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState('');
  const [library, setLibrary] = useState<Library>({ favorites: [], history: [] });
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  useEffect(() => {
    if (!result) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!saveLock.current) { setResult(null); setCompleted(0); setMessage(''); }
      return true;
    });
    return () => subscription.remove();
  }, [result]);
  useEffect(() => { AsyncStorage.getItem(storageKey).then(value => { setLibrary(readLibrary(value)); setReady(true); }).catch(() => setMessage('Não foi possível ler os dados deste aparelho. Reabra o aplicativo para tentar novamente.')); }, []);
  const locked = busy || locating || saving;
  function edit(action: () => void) { action(); setResult(null); setCompleted(0); setMessage(''); }
  async function persist(next: Library) {
    if (!ready || saveLock.current) return false;
    saveLock.current = true; setSaving(true);
    try { await AsyncStorage.setItem(storageKey, JSON.stringify(next)); setLibrary(next); return true; }
    catch { setMessage('Não foi possível salvar no aparelho. Tente novamente.'); return false; }
    finally { saveLock.current = false; setSaving(false); }
  }
  function snapshot(): SavedRoute { return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, origin: origin.trim(), stops: stops.map(s => s.trim()), date: new Date().toISOString() }; }
  async function favorite() {
    const error = validate(origin, stops); if (error) return setMessage(error);
    const route = snapshot();
    if (library.favorites.some(item => item.origin === route.origin && JSON.stringify(item.stops) === JSON.stringify(route.stops))) return setMessage('Esta rota já está nos favoritos.');
    if (await persist({ ...library, favorites: [route, ...library.favorites] })) setMessage('Rota salva nos favoritos deste aparelho.');
  }
  async function locate() {
    setLocating(true); setMessage('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Permissão de localização negada. Digite o endereço de partida.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      edit(() => setOrigin(`${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`));
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Localização indisponível. Digite sua partida.'); }
    finally { setLocating(false); }
  }
  async function search() {
    const error = validate(origin, stops); if (error) return setMessage(error);
    Keyboard.dismiss();
    setBusy(true); setMessage(''); setResult(null); setCompleted(0);
    try { setResult(await searchRoutes(origin.trim(), stops.map(s => s.trim()))); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível buscar as rotas.'); }
    finally { setBusy(false); }
  }
  async function navigate(apple = false) {
    if (!result) return;
    const target = result.legs[completed];
    const destination = target ? `${target.coordinate[1]},${target.coordinate[0]}` : null;
    if (!destination) return;
    const from = completed === 0 ? result.origin : result.legs[completed - 1];
    const departure = `${from.coordinate[1]},${from.coordinate[0]}`;
    const url = apple ? `https://maps.apple.com/?saddr=${encodeURIComponent(departure)}&daddr=${encodeURIComponent(destination)}&dirflg=d` : `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(departure)}&destination=${encodeURIComponent(destination)}&travelmode=driving&dir_action=navigate`;
    try { await Linking.openURL(url); } catch { setMessage('Não foi possível abrir o mapa neste aparelho.'); }
  }
  async function finishStop() {
    if (!result) return;
    if (completed + 1 === result.legs.length) {
      const route = { ...snapshot(), stops: result.legs.map(leg => leg.address) };
      if (!await persist({ ...library, history: [route, ...library.history] })) return;
      setResult(null); setCompleted(0); setMessage('Viagem concluída! Seu histórico foi salvo neste aparelho.');
    } else setCompleted(completed + 1);
  }
  function reuse(route: SavedRoute) { edit(() => { setOrigin(route.origin); setStops([...route.stops]); }); setTab('Planejar'); }
  const canSearch = !!origin.trim() && stops.every(s => s.trim());
  if (result) return <ActiveTrip route={result} completed={completed} message={message} saving={saving || !ready}
    onEdit={() => edit(() => {})} onNavigate={navigate} onComplete={finishStop} />;
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View style={styles.logo}><Text style={styles.logoText}>↗</Text></View><View><Text style={styles.brand}>GH Rotas<Text style={{ color: '#8651D4' }}>.</Text></Text><Text style={styles.muted}>Seu dia, no melhor caminho</Text></View><View style={styles.localBadge}><Text style={styles.badgeText}>SEM LOGIN</Text></View></View>
    <View style={styles.hero}><Text style={styles.eyebrow}>MENOS VOLTAS. MAIS ENTREGAS.</Text><Text style={styles.title}>Cada parada,{'\n'}um caminho mais simples.</Text><Text style={styles.subtitle}>Você escolhe os destinos. A gente organiza a sequência para sua viagem.</Text><View style={styles.heroLine}><Text style={styles.heroNote}>●  Partida  ─ ─  ①  ─ ─  ②  ─ ─  ⚑</Text></View></View>
    <View style={styles.tabs}>{(['Planejar', 'Favoritos', 'Histórico'] as Tab[]).map(item => <Pressable key={item} accessibilityRole="tab" accessibilityState={{ selected: tab === item }} onPress={() => { setTab(item); setMessage(''); }} style={[styles.tab, tab === item && styles.selectedTab]}><Text style={[styles.tabText, tab === item && { color: '#6D38C3' }]}>{item}{item === 'Favoritos' ? ` · ${library.favorites.length}` : item === 'Histórico' ? ` · ${library.history.length}` : ''}</Text></Pressable>)}</View>
    {!!message && tab !== 'Planejar' && <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View>}
    {tab === 'Planejar' ? <>
      <View style={styles.card}><View style={styles.headingRow}><View><Text style={styles.sectionTitle}>Planeje sua rota</Text><Text style={styles.muted}>Adicione os endereços na ordem que lembrar.</Text></View><Text style={styles.counter}>{stops.length}/8</Text></View>
        <Text style={styles.label}>PONTO DE PARTIDA</Text><TextInput accessibilityLabel="Endereço de partida" editable={!locked} style={styles.input} placeholder="Rua, número, cidade e estado" placeholderTextColor="#9690A3" value={origin} onChangeText={value => edit(() => setOrigin(value))} maxLength={500} />
        <Pressable accessibilityRole="button" disabled={locked} onPress={locate} style={styles.location}><Text style={styles.link}>{locating ? 'Localizando…' : '◎  Usar minha localização'}</Text></Pressable>
        <View style={styles.divider} /><Text style={styles.label}>ONDE VAMOS PARAR?</Text>
        {stops.map((stop, index) => <View key={index} style={styles.stopRow}><View style={styles.number}><Text style={styles.numberText}>{index + 1}</Text></View><TextInput accessibilityLabel={`Destino ${index + 1}`} editable={!locked} style={[styles.input, { flex: 1 }]} placeholder="Endereço completo do destino" placeholderTextColor="#9690A3" value={stop} maxLength={500} onChangeText={value => edit(() => setStops(stops.map((s, i) => i === index ? value : s)))} />{stops.length > 1 && <Pressable accessibilityRole="button" accessibilityLabel={`Remover destino ${index + 1}`} disabled={locked} onPress={() => edit(() => setStops(stops.filter((_, i) => i !== index)))} style={styles.remove}><Text style={styles.muted}>✕</Text></Pressable>}</View>)}
        {stops.length < 8 && <Button secondary disabled={locked} title="＋  Adicionar parada" onPress={() => edit(() => setStops([...stops, '']))} />}
        <View style={styles.divider} /><Button disabled={locked || !canSearch} title={busy ? 'Organizando sua rota…' : 'Buscar Rotas  ↗'} onPress={search} />
        {!!message && <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.notice}><Text style={styles.noticeText}>{message}</Text></View>}
        {busy && <ActivityIndicator color="#6D38C3" />}<Button secondary title="♡  Salvar nos favoritos" disabled={locked || !ready || !canSearch} onPress={favorite} />
        <Text style={styles.footnote}>O cálculo só começa quando você toca em Buscar Rotas. Até 8 destinos, sem retorno à partida.</Text>
      </View>
      {!result && <View style={styles.card}><Text style={styles.sectionTitle}>Seu caminho no mapa</Text><Text style={styles.muted}>Explore o mapa. Após buscar, o trajeto aparecerá com as paradas numeradas.</Text><RouteMap result={null} /></View>}
    </> : <View style={styles.card}><Text style={styles.sectionTitle}>{tab === 'Favoritos' ? 'Seus caminhos de sempre' : 'Viagens concluídas'}</Text><Text style={styles.muted}>Salvos somente neste aparelho.</Text>{!ready ? <Text style={styles.empty}>Seus dados locais ainda não estão disponíveis.</Text> : (tab === 'Favoritos' ? library.favorites : library.history).length === 0 ? <View style={styles.empty}><Text style={styles.emptyIcon}>{tab === 'Favoritos' ? '♡' : '↗'}</Text><Text style={styles.sectionTitle}>{tab === 'Favoritos' ? 'Seu próximo caminho começa aqui' : 'Uma nova história a cada viagem'}</Text><Text style={styles.muted}>{tab === 'Favoritos' ? 'Preencha uma rota e salve para encontrar depois.' : 'Conclua todas as paradas de uma rota para vê-la aqui.'}</Text><Button title="Planejar uma rota" secondary onPress={() => setTab('Planejar')} /></View> : (tab === 'Favoritos' ? library.favorites : library.history).map(route => <View key={route.id} style={styles.saved}><Text style={styles.address}>{route.origin}</Text><Text style={styles.muted}>{route.stops.length} parada(s) · {new Date(route.date).toLocaleDateString('pt-BR')}</Text>{route.stops.map((stop, i) => <Text key={i} style={styles.savedStop}>{i + 1}. {stop}</Text>)}<Button title="Usar estes endereços" secondary disabled={locked} onPress={() => reuse(route)} /><Button title="Remover deste aparelho" secondary disabled={saving} onPress={() => { const key = tab === 'Favoritos' ? 'favorites' : 'history'; void persist({ ...library, [key]: library[key].filter(item => item.id !== route.id) }); }} /></View>)}</View>}
    <Text style={styles.footer}>GH ROTAS  ·  Feito para seguir em frente.</Text><Text style={styles.footnote}>Favoritos e histórico ficam no dispositivo. Ao buscar rotas, os endereços são enviados ao OpenRouteService. O mapa de fundo é carregado do OpenStreetMap. Ao abrir a navegação, a partida e o destino são compartilhados com o mapa escolhido.</Text>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F6FA' }, page: { width: '100%', maxWidth: 780, alignSelf: 'center', padding: 20, paddingBottom: 40, gap: 20 }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }, logo: { backgroundColor: '#6D38C3', width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, logoText: { color: 'white', fontSize: 32, fontWeight: '700' }, brand: { color: '#251837', fontSize: 23, fontWeight: '800' }, muted: { color: '#7D748B', fontSize: 13, lineHeight: 20 }, localBadge: { marginLeft: 'auto', backgroundColor: '#EBE5F5', padding: 8, borderRadius: 20 }, badgeText: { fontSize: 9, fontWeight: '800', color: '#6D38C3', letterSpacing: 1 }, hero: { backgroundColor: '#EEE7FA', borderRadius: 26, padding: 26, gap: 14, overflow: 'hidden' }, eyebrow: { color: '#6D38C3', fontSize: 10, letterSpacing: 1.8, fontWeight: '800' }, title: { color: '#302044', fontSize: 32, lineHeight: 39, fontWeight: '800', letterSpacing: -1 }, subtitle: { color: '#77658C', fontSize: 15, lineHeight: 23, maxWidth: 440 }, heroLine: { flexDirection: 'row', paddingTop: 8 }, heroNote: { color: '#9674C5', fontWeight: '600', fontSize: 15 }, tabs: { flexDirection: 'row', backgroundColor: '#EEEBF2', padding: 5, borderRadius: 16 }, tab: { flex: 1, paddingVertical: 13, alignItems: 'center', borderRadius: 12 }, selectedTab: { backgroundColor: '#FFF' }, tabText: { fontWeight: '700', color: '#82758E', fontSize: 13 }, card: { padding: 22, borderRadius: 24, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#EDE8F3', gap: 14 }, headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, sectionTitle: { fontSize: 20, fontWeight: '700', color: '#302044', lineHeight: 27 }, counter: { color: '#957BB5', fontSize: 13 }, label: { color: '#7A6B88', fontSize: 10, fontWeight: '800', letterSpacing: 1.3, marginTop: 8 }, input: { backgroundColor: '#FAF9FC', borderWidth: 1, borderColor: '#E8E1EF', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 15, fontSize: 14, color: '#302044', minHeight: 50 }, location: { alignSelf: 'flex-start', paddingVertical: 8, minHeight: 40 }, link: { color: '#7B45C9', fontWeight: '600', fontSize: 13 }, divider: { height: 1, backgroundColor: '#F0ECF5', marginVertical: 2 }, stopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, number: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#F0E9FA', justifyContent: 'center', alignItems: 'center' }, numberText: { color: '#804AC9', fontSize: 12, fontWeight: '700' }, remove: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }, button: { borderRadius: 13, minHeight: 48, backgroundColor: '#6D38C3', paddingHorizontal: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' }, secondary: { backgroundColor: '#F3EFF9' }, buttonText: { color: '#FFF', fontSize: 14, fontWeight: '700', textAlign: 'center' }, footnote: { color: '#91859D', fontSize: 11, lineHeight: 17, textAlign: 'center' }, notice: { borderRadius: 16, padding: 18, backgroundColor: '#F0EAF8', gap: 6 }, noticeTitle: { color: '#583B7C', fontSize: 14, fontWeight: '700' }, noticeText: { color: '#78628F', fontSize: 13, lineHeight: 20 }, leg: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F0ECF5' }, address: { color: '#302044', fontWeight: '600', fontSize: 14, lineHeight: 22 }, empty: { paddingVertical: 25, gap: 15 }, emptyIcon: { color: '#9865D5', fontSize: 40 }, saved: { borderTopWidth: 1, borderColor: '#EEE8F4', paddingTop: 20, gap: 10 }, savedStop: { color: '#77658C', lineHeight: 21, fontSize: 13 }, footer: { color: '#A093AC', fontSize: 10, fontWeight: '600', letterSpacing: 1.3, textAlign: 'center', marginTop: 6 },
});
