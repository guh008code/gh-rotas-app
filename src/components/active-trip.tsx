import { Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import RouteMap from './route-map';
import type { RouteResult } from '@/lib/routes';

type Props = {
  route: RouteResult;
  completed: number;
  message: string;
  saving: boolean;
  onEdit: () => void;
  onNavigate: (apple?: boolean) => void;
  onComplete: () => void;
};

export default function ActiveTrip({ route, completed, message, saving, onEdit, onNavigate, onComplete }: Props) {
  const { height } = useWindowDimensions();
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <View><Text style={styles.title}>Sua viagem</Text><Text style={styles.caption}>{completed} de {route.legs.length} paradas concluídas</Text></View>
      <Pressable accessibilityRole="button" disabled={saving} onPress={onEdit} style={styles.edit}><Text style={styles.link}>Editar rota</Text></Pressable>
    </View>
    <ScrollView contentContainerStyle={styles.content}>
      <RouteMap result={route} completed={completed} height={Math.min(520, Math.max(320, height * 0.48))} />
      <View style={styles.addresses}>
        <View style={styles.row}><View style={[styles.badge, styles.start]}><Text style={styles.badgeText}>P</Text></View><View style={styles.text}><Text style={styles.caption}>PARTIDA</Text><Text style={styles.address}>{route.origin.label}</Text></View></View>
        {route.legs.map((leg, index) => <View key={index} style={[styles.row, index === completed && styles.next, index < completed && styles.done]}>
          <View style={styles.badge}><Text style={styles.badgeText}>{index < completed ? '✓' : index + 1}</Text></View>
          <View style={styles.text}><Text style={styles.caption}>{index < completed ? 'CONCLUÍDA' : index === completed ? 'PRÓXIMA PARADA' : `DESTINO ${index + 1}`}</Text><Text style={styles.address}>{leg.label}</Text></View>
        </View>)}
      </View>
      {!!message && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.message}>{message}</Text>}
      <Pressable accessibilityRole="button" onPress={() => onNavigate()} style={styles.button}><Text style={styles.buttonText}>Navegar até a próxima parada ↗</Text></Pressable>
      {Platform.OS === 'ios' && <Pressable accessibilityRole="button" onPress={() => onNavigate(true)} style={styles.secondary}><Text style={styles.link}>Abrir no Mapas da Apple</Text></Pressable>}
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} onPress={onComplete} style={[styles.secondary, saving && { opacity: 0.5 }]}><Text style={styles.link}>{saving ? 'Salvando…' : completed + 1 === route.legs.length ? '✓ Concluir viagem' : '✓ Concluir esta parada'}</Text></Pressable>
    </ScrollView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F6FA' },
  header: { width: '100%', maxWidth: 780, alignSelf: 'center', padding: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { color: '#302044', fontSize: 22, fontWeight: '700' },
  caption: { color: '#7D748B', fontSize: 11, lineHeight: 18 },
  edit: { minHeight: 44, paddingHorizontal: 12, justifyContent: 'center' },
  link: { color: '#6D38C3', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  content: { width: '100%', maxWidth: 780, alignSelf: 'center', paddingHorizontal: 16, paddingBottom: 24, gap: 12 },
  addresses: { backgroundColor: 'white', borderRadius: 16, padding: 8, gap: 4 },
  row: { flexDirection: 'row', gap: 12, padding: 12, alignItems: 'center', borderRadius: 12 },
  next: { backgroundColor: '#F0E9FA' },
  done: { opacity: 0.55 },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6D38C3' },
  start: { backgroundColor: '#285F50' },
  badgeText: { color: 'white', fontWeight: '700', fontSize: 12 },
  text: { flex: 1, gap: 2 },
  address: { color: '#302044', fontSize: 14, lineHeight: 21, fontWeight: '600' },
  button: { minHeight: 48, padding: 15, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: '#6D38C3' },
  buttonText: { color: 'white', fontWeight: '700', fontSize: 14, textAlign: 'center' },
  secondary: { minHeight: 48, padding: 15, borderRadius: 13, justifyContent: 'center', backgroundColor: '#EEE7FA' },
  message: { padding: 14, color: '#583B7C', backgroundColor: '#EEE7FA', borderRadius: 12 },
});
