import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, TextInput, FlatList, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function HomeScreen({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [weekDays, setWeekDays] = useState([]);

  useEffect(() => {
    generateWeek();
    fetchTasks();
  }, [selectedDate]);

  const generateWeek = () => {
    let days = [];
    let today = new Date();
    for (let i = -3; i <= 3; i++) {
      let d = new Date();
      d.setDate(today.getDate() + i);
      days.push({
        fullDate: d.toISOString().split('T')[0],
        dayName: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
        dayNum: d.getDate()
      });
    }
    setWeekDays(days);
  };

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('*')
      .eq('deadline', selectedDate)
      .order('is_starred', { ascending: false });
    setTasks(data || []);
    setLoading(false);
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('tasks').insert([{ user_id: user.id, title: taskTitle, deadline: selectedDate }]);
    setTaskTitle(''); 
    fetchTasks();
  };

  const toggleStar = async (id, current) => {
    await supabase.from('tasks').update({ is_starred: !current }).eq('id', id);
    fetchTasks();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ajandam</Text>
        <TouchableOpacity onPress={() => setMenuVisible(true)}>
          <Ionicons name="person-circle-outline" size={38} color="#800000" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calendarStrip}>
        {weekDays.map((item) => (
          <TouchableOpacity 
            key={item.fullDate} 
            onPress={() => setSelectedDate(item.fullDate)}
            style={[styles.dayCard, selectedDate === item.fullDate && styles.activeDayCard]}
          >
            <Text style={[styles.dayText, selectedDate === item.fullDate && styles.activeText]}>{item.dayName}</Text>
            <Text style={[styles.dayNum, selectedDate === item.fullDate && styles.activeText]}>{item.dayNum}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.inputCard}>
        <TextInput 
          style={styles.input} 
          placeholder="Bu güne görev ekle..." 
          value={taskTitle}
          onChangeText={setTaskTitle}
        />
        <TouchableOpacity style={styles.addBtn} onPress={addTask}>
          <Ionicons name="add" size={28} color="#fff" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#800000" style={{ marginTop: 20 }} />
      ) : (
        <FlatList 
          data={tasks}
          keyExtractor={(item) => item.id.toString()}
          renderItem={({ item }) => (
            <View style={styles.taskItem}>
              <View style={{ flex: 1 }}>
                <Text style={styles.taskTitle}>{item.title}</Text>
                <Text style={styles.taskStatus}>{item.org_id ? "Grup Görevi" : "Kişisel"}</Text>
              </View>
              <TouchableOpacity onPress={() => toggleStar(item.id, item.is_starred)}>
                <Ionicons name={item.is_starred ? "star" : "star-outline"} size={22} color={item.is_starred ? "#FFD700" : "#ccc"} />
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      <Modal transparent visible={menuVisible} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={styles.menuContainer}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate('Organizations'); }}>
              <Ionicons name="people-outline" size={20} color="#333" />
              <Text style={styles.menuText}>Organizasyonlarım</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => supabase.auth.signOut()}>
              <Ionicons name="log-out-outline" size={20} color="red" />
              <Text style={[styles.menuText, { color: 'red' }]}>Çıkış Yap</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 10 },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#800000' },
  calendarStrip: { maxHeight: 110, paddingLeft: 20, marginVertical: 15 },
  dayCard: { width: 65, height: 85, backgroundColor: '#f9f9f9', borderRadius: 15, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: '#eee' },
  activeDayCard: { backgroundColor: '#800000', borderColor: '#800000' },
  dayText: { color: '#999', fontSize: 13 },
  dayNum: { fontSize: 20, fontWeight: 'bold', color: '#333', marginTop: 5 },
  activeText: { color: '#fff' },
  inputCard: { flexDirection: 'row', backgroundColor: '#fff', marginHorizontal: 20, padding: 10, borderRadius: 15, alignItems: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 5 },
  input: { flex: 1, paddingHorizontal: 15, fontSize: 16 },
  addBtn: { backgroundColor: '#800000', width: 45, height: 45, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  taskItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fcfcfc', marginHorizontal: 20, marginBottom: 10, padding: 18, borderRadius: 15, borderLeftWidth: 4, borderLeftColor: '#800000' },
  taskTitle: { fontSize: 16, fontWeight: '500' },
  taskStatus: { fontSize: 12, color: '#999', marginTop: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)' },
  menuContainer: { position: 'absolute', top: 100, right: 25, backgroundColor: '#fff', width: 220, borderRadius: 15, padding: 15, elevation: 10 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  menuText: { marginLeft: 12, fontSize: 15 }
});