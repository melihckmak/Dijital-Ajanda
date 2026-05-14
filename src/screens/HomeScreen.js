import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Pressable, TextInput, FlatList, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import { Calendar, LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['tr'] = {
  monthNames: ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'],
  monthNamesShort: ['Oca','Şub','Mar','Nis','May','Haz','Tem','Ağu','Eyl','Eki','Kas','Ara'],
  dayNames: ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'],
  dayNamesShort: ['Paz','Pzt','Sal','Çar','Per','Cum','Cmt'],
  today: 'Bugün'
};
LocaleConfig.defaultLocale = 'tr';

// API Anahtarını alıyoruz
const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

const specialDaysList = {
  '2026-03-19': '🍬 Ramazan Bayramı Arifesi',
  '2026-03-20': '🍬 Ramazan Bayramı 1. Gün',
  '2026-03-21': '🍬 Ramazan Bayramı 2. Gün',
  '2026-03-22': '🍬 Ramazan Bayramı 3. Gün',
  '2026-04-23': '🎈 23 Nisan Ulusal Egemenlik ve Çocuk Bayramı',
  '2026-05-01': '👷 1 Mayıs Emek ve Dayanışma Günü',
  '2026-05-19': '🏃 19 Mayıs Atatürk\'ü Anma, Gençlik ve Spor Bayramı',
  '2026-05-26': '🥩 Kurban Bayramı Arifesi',
  '2026-05-27': '🥩 Kurban Bayramı 1. Gün',
  '2026-05-28': '🥩 Kurban Bayramı 2. Gün',
  '2026-05-29': '🥩 Kurban Bayramı 3. Gün',
  '2026-05-30': '🥩 Kurban Bayramı 4. Gün',
  '2026-07-15': '🇹🇷 15 Temmuz Demokrasi ve Milli Birlik Günü',
  '2026-08-30': '🇹🇷 30 Ağustos Zafer Bayramı',
  '2026-10-29': '🎆 29 Ekim Cumhuriyet Bayramı'
};

export default function HomeScreen({ navigation }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState('Görev');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [dailyQuote, setDailyQuote] = useState('');
  const [quoteLoading, setQuoteLoading] = useState(false);
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editSubtasks, setEditSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');

  const [isDiaryUnlocked, setIsDiaryUnlocked] = useState(false);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');
  const [userPin, setUserPin] = useState(null);
  const [changePinModalVisible, setChangePinModalVisible] = useState(false);
  const [newPinInput, setNewPinInput] = useState('');

  const [notificationsModalVisible, setNotificationsModalVisible] = useState(false);
  const [pendingInvitesList, setPendingInvitesList] = useState([]);
  const [recentOrgTasks, setRecentOrgTasks] = useState([]);
  const [totalUnreadCount, setTotalUnreadCount] = useState(0);

  const [currentUserId, setCurrentUserId] = useState(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [myProfile, setMyProfile] = useState({ full_name: '', phone_number: '', bio: '', email: '', total_focus_minutes: 0 });
  const [newPassword, setNewPassword] = useState('');

  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastData, setToastData] = useState({ title: '', message: '' });

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [pomodoroModalVisible, setPomodoroModalVisible] = useState(false);
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60); 
  const [isPomodoroActive, setIsPomodoroActive] = useState(false);
  const [pomodoroMode, setPomodoroMode] = useState('focus'); 
  const timerRef = useRef(null);

  const showToast = (title, message) => {
    setToastData({ title, message });
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 4000);
  };

  const markedDates = {
    [selectedDate]: { selected: true, selectedColor: '#800000' },
  };
  Object.keys(specialDaysList).forEach(date => {
    if (date !== selectedDate) {
      markedDates[date] = { marked: true, dotColor: 'red' };
    } else {
      markedDates[date] = { selected: true, marked: true, selectedColor: '#800000', dotColor: 'white' };
    }
  });

  useEffect(() => { fetchDailyQuote(); }, [selectedDate]);

  useEffect(() => {
    fetchTasks(); checkUserPin(); fetchNotifications(); fetchMyProfile();
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'organization_members' }, (payload) => {
        if(payload.new.user_id === currentUserId && payload.new.status === 'pending') {
            fetchNotifications(); showToast('🤝 Yeni Takım Daveti!', 'Seni bir takıma davet ettiler. Zile tıklayıp kontrol et!');
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks' }, (payload) => {
        if(payload.new.assigned_to === currentUserId && payload.new.org_id !== null) {
            fetchNotifications(); showToast('🔔 Yeni Görev!', 'Takımdan sana yeni bir görev atandı.');
        }
      }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [selectedDate, taskType, currentUserId]);

  useEffect(() => {
    if (isPomodoroActive && pomodoroTime > 0) {
      timerRef.current = setInterval(() => { setPomodoroTime((prev) => prev - 1); }, 1000);
    } else if (pomodoroTime === 0) {
      clearInterval(timerRef.current); handlePomodoroEnd();
    }
    return () => clearInterval(timerRef.current);
  }, [isPomodoroActive, pomodoroTime]);

  const handlePomodoroEnd = async () => {
    setIsPomodoroActive(false);
    if (pomodoroMode === 'focus') {
      showToast('🎯 Harika İş!', '25 dakikalık odaklanma süresini tamamladın.');
      setPomodoroMode('break'); setPomodoroTime(5 * 60); 
      if (currentUserId) {
        const newTotal = (myProfile.total_focus_minutes || 0) + 25;
        await supabase.from('profiles').update({ total_focus_minutes: newTotal }).eq('id', currentUserId);
        setMyProfile({...myProfile, total_focus_minutes: newTotal});
      }
    } else {
      showToast('☕ Mola Bitti', 'Yeniden odaklanma zamanı!');
      setPomodoroMode('focus'); setPomodoroTime(25 * 60);
    }
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const toggleTheme = async () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme); setMenuVisible(false);
    if (currentUserId) { await supabase.from('profiles').update({ theme_preference: newTheme ? 'dark' : 'light' }).eq('id', currentUserId); }
  };

  const fetchDailyQuote = async () => {
    setQuoteLoading(true);
    try {
      const prompt = `Sen dünyaca ünlü, vizyoner bir lidersin. Tarih: ${selectedDate}. Sadece bu spesifik güne ve enerjiye uygun, sarsıcı, derin anlamlı, havalı ve insanın içindeki potansiyeli ortaya çıkaran yepyeni çok kısa bir motivasyon sözü söyle. Açıklama yapma, sadece sözü yaz.`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      
      // HATA KONTROLÜ
      if (!response.ok) {
         throw new Error(data.error?.message || "Google API bir hata döndürdü.");
      }

      setDailyQuote(data.candidates[0].content.parts[0].text.trim());
    } catch (error) {
      console.log("Söz Hatası:", error.message);
      setDailyQuote("Disiplin, hedeflerin ile başarıların arasındaki köprüdür. 🔥");
    } finally {
      setQuoteLoading(false);
    }
  };

  const checkUserPin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
      const { data } = await supabase.from('profiles').select('diary_pin, theme_preference').eq('id', user.id).single();
      setUserPin(data?.diary_pin || null);
      if (data?.theme_preference === 'dark') setIsDarkMode(true);
    }
  };

  const saveNewPin = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const cleanPin = String(newPinInput).trim();
    await supabase.from('profiles').update({ diary_pin: cleanPin || null }).eq('id', user.id);
    setUserPin(cleanPin || null);
    setChangePinModalVisible(false); setNewPinInput('');
    Alert.alert("Başarılı", "Günlük şifren güncellendi.");
  };

  const fetchMyProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (data) setMyProfile({...data, email: user.email}); 
    }
  };

  const updateProfile = async () => {
    const { error } = await supabase.from('profiles').update({ full_name: myProfile.full_name, phone_number: myProfile.phone_number, bio: myProfile.bio }).eq('id', currentUserId);
    if (!error) { setProfileModalVisible(false); Alert.alert("Başarılı", "Profil adın güncellendi!"); fetchTasks(); }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) return Alert.alert("Hata", "Şifre en az 6 karakter olmalı!");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) { Alert.alert("Başarılı", "Şifren değiştirildi!"); setNewPassword(''); }
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: invites } = await supabase.from('organization_members').select('id, organizations(id, name), invite_message').eq('user_id', user.id).eq('status', 'pending');
      const { data: orgTasks } = await supabase.from('tasks').select('id, title, organizations(name)').eq('assigned_to', user.id).not('org_id', 'is', null).eq('status', 'To-Do');
      setPendingInvitesList(invites || []); setRecentOrgTasks(orgTasks || []);
      setTotalUnreadCount((invites?.length || 0) + (orgTasks?.length || 0));
    }
  };

  const respondToInvite = async (orgId, status) => {
    await supabase.from('organization_members').update({ status: status }).eq('org_id', orgId).eq('user_id', currentUserId);
    fetchNotifications(); showToast('Başarılı', status === 'accepted' ? 'Takıma katıldın!' : 'Daveti reddettin.');
  };

  const fetchTasks = async () => {
    setLoading(true);
    const { data } = await supabase.from('tasks').select('*, assignee_profile:profiles!tasks_assigned_to_fkey(full_name)').eq('deadline', selectedDate).eq('category', taskType).is('org_id', null).order('is_starred', { ascending: false });
    setTasks(data || []); setLoading(false);
  };

  const handleDiaryAccess = () => {
    if (userPin && !isDiaryUnlocked) { setPinModalVisible(true); } else { setTaskType('Günlük'); }
  };

  const verifyPin = () => {
    if (String(enteredPin).trim() === String(userPin).trim()) { 
        setIsDiaryUnlocked(true); setPinModalVisible(false); setTaskType('Günlük'); setEnteredPin(''); 
    } else { 
        Alert.alert("Hata", "Hatalı PIN kodu!"); setEnteredPin(''); 
    }
  };

  const addTask = async () => {
    if (!taskTitle.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from('tasks').insert([{ user_id: user.id, title: taskTitle, deadline: selectedDate, category: taskType, org_id: null, assigned_to: user.id, is_completed: false, status: 'To-Do', notes: '', subtasks: [] }]);
    if (!error) { setTaskTitle(''); fetchTasks(); } 
  };

  const cycleTaskStatus = async (task) => {
    let nextStatus = task.status === 'To-Do' ? 'In Progress' : (task.status === 'In Progress' ? 'Done' : 'To-Do');
    let isCompleted = nextStatus === 'Done';
    await supabase.from('tasks').update({ status: nextStatus, is_completed: isCompleted }).eq('id', task.id);
    fetchTasks();
  };

  const toggleStar = async (id, current) => { await supabase.from('tasks').update({ is_starred: !current }).eq('id', id); fetchTasks(); };

  const deleteTask = (id) => {
    Alert.alert("Kaydı Sil", "Emin misin?", [{ text: "İptal", style: "cancel" }, { text: "Sil", style: "destructive", onPress: async () => { await supabase.from('tasks').delete().eq('id', id); fetchTasks(); } }]);
  };

  const openEditModal = (task) => {
    if (task.category === 'Günlük' && userPin && !isDiaryUnlocked) { handleDiaryAccess(); return; }
    setEditingTask(task); setEditTitle(task.title); setEditNotes(task.notes || ''); setEditSubtasks(task.subtasks || []); setEditModalVisible(true);
  };

  const saveEditTask = async () => {
    if (!editTitle.trim()) return;
    const allSubtasksDone = editSubtasks.length > 0 && editSubtasks.every(st => st.completed);
    const { error } = await supabase.from('tasks').update({ title: editTitle, notes: editNotes, subtasks: editSubtasks, is_completed: allSubtasksDone ? true : editingTask.is_completed, status: allSubtasksDone ? 'Done' : editingTask.status }).eq('id', editingTask.id);
    if (!error) { setEditModalVisible(false); fetchTasks(); }
  };

  const addSubtask = () => { if(!newSubtask.trim()) return; setEditSubtasks([...editSubtasks, { id: Date.now().toString(), text: newSubtask, completed: false }]); setNewSubtask(''); };
  const toggleSubtask = (id) => setEditSubtasks(editSubtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st));
  const deleteSubtask = (id) => setEditSubtasks(editSubtasks.filter(st => st.id !== id));

  const prioritizeWithAI = async () => {
    if (tasks.length === 0) return;
    
    // GÜVENLİK KONTROLÜ: API ANAHTARI VAR MI?
    if (!GEMINI_API_KEY) {
      Alert.alert("Eksik Kurulum", ".env dosyasındaki EXPO_PUBLIC_GEMINI_API_KEY bulunamadı. Terminali 'expo start -c' ile baştan başlatın.");
      return;
    }

    setAiLoading(true);
    try {
      const taskListString = tasks.map((t, index) => `${index + 1}. ${t.title}`).join('\n');
      const prompt = `Aşağıdaki görev listesini aciliyet ve mantıksal sıraya göre analiz et. Sadece numaraları virgülle ayırarak yaz:\n${taskListString}`;
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      
      const data = await response.json();
      
      // GERÇEK HATAYI EKRANA BASACAK KISIM
      if (!response.ok) {
         throw new Error(data.error?.message || "Google API bir hata fırlattı, lütfen detayları kontrol et.");
      }

      const orderIndexes = data.candidates[0].content.parts[0].text.trim().split(',').map(num => parseInt(num.trim()) - 1).filter(num => !isNaN(num) && num >= 0 && num < tasks.length);
      if (orderIndexes.length > 0) {
          const sortedTasks = orderIndexes.map(index => tasks[index]);
          const remainingTasks = tasks.filter((t, index) => !orderIndexes.includes(index));
          setTasks([...sortedTasks, ...remainingTasks]); showToast('🤖 Yapay Zeka', 'Görevler yeniden düzenlendi!');
      }
    } catch (error) { 
        // İŞTE BİZE LAZIM OLAN HATA MESAJI BURADA ÇIKACAK!
        Alert.alert("Yapay Zeka Hatası 🚨", `Sebep: ${error.message}`); 
    } finally { 
        setAiLoading(false); 
    }
  };

  const calculateProgress = (subtasks) => {
    if (!subtasks || subtasks.length === 0) return 0;
    return (subtasks.filter(s => s.completed).length / subtasks.length) * 100;
  };

  const getStatusIcon = (status) => {
    if (status === 'Done') return { name: "checkmark-circle", color: "green" };
    if (status === 'In Progress') return { name: "play-circle", color: "#00AEEF" };
    return { name: "ellipse-outline", color: "#ccc" };
  };

  const completedTasksCount = tasks.filter(t => t.status === 'Done').length;
  const totalTasksCount = tasks.length;
  const dailyProgressPercent = totalTasksCount === 0 ? 0 : Math.round((completedTasksCount / totalTasksCount) * 100);

  const themeBg = isDarkMode ? '#121212' : '#f9f9f9';
  const themeCard = isDarkMode ? '#1E1E1E' : '#fff';
  const themeText = isDarkMode ? '#E0E0E0' : '#333';
  const themeSubText = isDarkMode ? '#A0A0A0' : '#666';
  const themeInputBg = isDarkMode ? '#2C2C2C' : '#f5f5f5';

  const renderHeader = () => (
    <View>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerGreeting, { color: themeSubText }]}>Merhaba, {myProfile.full_name?.split(' ')[0]}</Text>
          <Text style={styles.headerTitle}>Kişisel Ajandam</Text>
        </View>
        <View style={{flexDirection: 'row', alignItems: 'center', gap: 15}}>
          <TouchableOpacity onPress={() => setNotificationsModalVisible(true)} style={styles.profileIconContainer}>
            <Ionicons name="notifications-outline" size={32} color="#800000" />
            {totalUnreadCount > 0 && <View style={styles.notificationDot} />}
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.profileIconContainer}>
            <Ionicons name="person-circle-outline" size={45} color="#800000" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.dailyProgressBox}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
          <Text style={{fontWeight: 'bold', color: themeSubText, fontSize: 13}}>Bugünkü İlerleme</Text>
          <Text style={{fontWeight: 'bold', color: '#800000', fontSize: 13}}>{completedTasksCount} / {totalTasksCount} Tamamlandı</Text>
        </View>
        <View style={[styles.dailyProgressBarBg, { backgroundColor: isDarkMode ? '#333' : '#e0e0e0' }]}>
          <View style={[styles.dailyProgressBarFill, { width: `${dailyProgressPercent}%` }]} />
        </View>
      </View>

      <View style={[styles.calendarWrapper, { backgroundColor: themeCard }]}>
        <Calendar
          onDayPress={day => { setSelectedDate(day.dateString); setIsDiaryUnlocked(false); }}
          markedDates={markedDates}
          theme={{
            backgroundColor: themeCard, calendarBackground: themeCard, textSectionTitleColor: themeSubText,
            selectedDayBackgroundColor: '#800000', selectedDayTextColor: '#ffffff', todayTextColor: '#00AEEF',
            dayTextColor: themeText, textDisabledColor: isDarkMode ? '#444' : '#d9e1e8', dotColor: '#00adf5',
            monthTextColor: isDarkMode ? '#fff' : '#800000', arrowColor: '#800000', textDayFontSize: 13, textMonthFontSize: 16, textDayHeaderFontSize: 12,
            'stylesheet.calendar.header': { week: { marginTop: 5, flexDirection: 'row', justifyContent: 'space-between' } }
          }}
          style={{ paddingBottom: 5 }}
        />
        {specialDaysList[selectedDate] && (
          <View style={{ backgroundColor: '#800000', padding: 8, alignItems: 'center' }}>
            <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 13 }}>{specialDaysList[selectedDate]}</Text>
          </View>
        )}
      </View>

      <View style={[styles.quoteCard, { backgroundColor: themeCard }]}>
        <Ionicons name="bulb-outline" size={24} color="#FFD700" style={{marginRight: 10}} />
        <View style={{flex: 1}}>
          {quoteLoading ? <ActivityIndicator size="small" color="#800000" /> : <Text style={[styles.quoteText, { color: themeText }]}>"{dailyQuote}"</Text>}
        </View>
      </View>

      <View style={styles.typeSelector}>
        {['Görev', 'Ödev', 'Proje'].map((type) => (
          <TouchableOpacity key={type} onPress={() => { setTaskType(type); setIsDiaryUnlocked(false); }} style={[styles.typeBtn, taskType === type && styles.activeTypeBtn, { backgroundColor: taskType === type ? '#800000' : (isDarkMode ? '#333' : '#e0e0e0') }]}>
            <Text style={[styles.typeBtnText, taskType === type && styles.activeTypeText, { color: taskType === type ? '#fff' : themeText }]}>{type}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={handleDiaryAccess} style={[styles.typeBtn, taskType === 'Günlük' && styles.activeTypeBtn, { borderColor: '#FFD700', borderWidth: userPin ? 1 : 0, backgroundColor: taskType === 'Günlük' ? '#800000' : (isDarkMode ? '#333' : '#e0e0e0') }]}>
          <Ionicons name={userPin && !isDiaryUnlocked ? "lock-closed" : "book"} size={14} color={taskType === 'Günlük' ? "#fff" : themeSubText} style={{marginRight: 4}} />
          <Text style={[styles.typeBtnText, taskType === 'Günlük' && styles.activeTypeText, { color: taskType === 'Günlük' ? '#fff' : themeText }]}>Günlük</Text>
        </TouchableOpacity>
      </View>

      {!(taskType === 'Günlük' && userPin && !isDiaryUnlocked) && (
        <View style={[styles.inputCard, { backgroundColor: themeCard }]}>
          <TextInput style={[styles.input, { color: themeText }]} placeholder={`Kişisel ${taskType} başlığı gir...`} placeholderTextColor={themeSubText} value={taskTitle} onChangeText={setTaskTitle} />
          <TouchableOpacity style={styles.addBtn} onPress={addTask}><Ionicons name="add" size={28} color="#fff" /></TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.aiBtn} onPress={prioritizeWithAI} disabled={aiLoading || (loading ? [] : tasks).length === 0}>
        {aiLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.aiBtnText}>✨ Yapay Zeka ile Önceliklendir</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeBg }]}>
      {toastVisible && (
        <View style={styles.toastContainer}>
          <Ionicons name="notifications" size={24} color="#fff" />
          <View style={{marginLeft: 12, flex: 1}}><Text style={styles.toastTitle}>{toastData.title}</Text><Text style={styles.toastMsg}>{toastData.message}</Text></View>
          <TouchableOpacity onPress={() => setToastVisible(false)}><Ionicons name="close" size={20} color="#fff" /></TouchableOpacity>
        </View>
      )}

      <FlatList 
        ListHeaderComponent={renderHeader}
        data={loading ? [] : tasks} 
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? ( <ActivityIndicator size="large" color="#800000" style={{ marginTop: 30 }} /> ) : (
            <View style={styles.emptyStateContainer}>
              <Ionicons name="document-text-outline" size={60} color={isDarkMode ? '#444' : '#ddd'} />
              <Text style={[styles.emptyStateText, { color: themeSubText }]}>Bu kategori için henüz bir kayıt bulunmuyor.</Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          if (item.category === 'Günlük' && userPin && !isDiaryUnlocked) {
            return (
              <TouchableOpacity style={[styles.lockedTaskItem, { backgroundColor: isDarkMode ? '#1e1e1e' : '#2b2b2b' }]} onPress={handleDiaryAccess}>
                <Ionicons name="lock-closed" size={32} color="#888" />
                <Text style={styles.lockedTaskText}>İçeriği görmek için şifreni gir</Text>
              </TouchableOpacity>
            )
          }
          const progress = calculateProgress(item.subtasks);
          const statusIcon = getStatusIcon(item.status);

          return (
          <TouchableOpacity style={[styles.taskItem, { backgroundColor: themeCard }, item.status === 'Done' && styles.taskCompletedItem]} onPress={() => openEditModal(item)}>
            <TouchableOpacity onPress={() => cycleTaskStatus(item)}><Ionicons name={statusIcon.name} size={28} color={statusIcon.color} /></TouchableOpacity>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={[styles.taskTitle, { color: themeText }, item.status === 'Done' && styles.taskCompletedText]}>{item.title}</Text>
              {item.subtasks && item.subtasks.length > 0 && (
                <View style={[styles.progressBarContainer, { backgroundColor: isDarkMode ? '#333' : '#eee' }]}>
                  <View style={[styles.progressBarFill, { width: `${progress}%`, backgroundColor: progress === 100 ? 'green' : '#00AEEF' }]} />
                </View>
              )}
            </View>
            <View style={{flexDirection: 'row', gap: 10}}>
              <TouchableOpacity onPress={() => toggleStar(item.id, item.is_starred)}><Ionicons name={item.is_starred ? "star" : "star-outline"} size={22} color={item.is_starred ? "#FFD700" : (isDarkMode ? '#555' : '#ccc')} /></TouchableOpacity>
            </View>
          </TouchableOpacity>
          )
        }}
      />

      <Modal visible={notificationsModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalBox, { backgroundColor: themeCard, maxHeight: '80%' }]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: isDarkMode ? '#444' : '#eee', paddingBottom: 15, marginBottom: 15}}>
              <Text style={{fontSize: 22, fontWeight: 'bold', color: themeText}}>Bildirim Merkezi</Text>
              <TouchableOpacity onPress={() => setNotificationsModalVisible(false)}><Ionicons name="close" size={28} color={themeText} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={{fontWeight: 'bold', color: '#800000', marginBottom: 10, fontSize: 16}}>🤝 Takım Davetleri</Text>
              {pendingInvitesList.length === 0 ? <Text style={{color: themeSubText, fontStyle: 'italic', marginBottom: 20}}>Bekleyen davetiniz yok.</Text> : pendingInvitesList.map(inv => (
                <View key={inv.id} style={{backgroundColor: themeInputBg, padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: isDarkMode ? '#444' : '#eee'}}>
                  <Text style={{fontWeight: 'bold', fontSize: 16, color: themeText}}>{inv.organizations.name}</Text>
                  {inv.invite_message && <Text style={{color: themeSubText, fontStyle: 'italic', marginTop: 5}}>"{inv.invite_message}"</Text>}
                  <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                    <TouchableOpacity onPress={() => respondToInvite(inv.organizations.id, 'accepted')} style={[styles.saveBtn, {backgroundColor: 'green', flex: 1, paddingVertical: 10, alignItems: 'center'}]}><Text style={{color: '#fff', fontWeight: 'bold'}}>Kabul Et</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => respondToInvite(inv.organizations.id, 'rejected')} style={[styles.saveBtn, {backgroundColor: '#800000', flex: 1, paddingVertical: 10, alignItems: 'center'}]}><Text style={{color: '#fff', fontWeight: 'bold'}}>Reddet</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
              <Text style={{fontWeight: 'bold', color: '#00AEEF', marginBottom: 10, marginTop: 10, fontSize: 16}}>📋 Yeni Takım Görevleri</Text>
              {recentOrgTasks.length === 0 ? <Text style={{color: themeSubText, fontStyle: 'italic'}}>Yeni atanmış görev yok.</Text> : recentOrgTasks.map(t => (
                <View key={t.id} style={{backgroundColor: themeInputBg, padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: isDarkMode ? '#444' : '#eee', flexDirection: 'row', alignItems: 'center'}}>
                  <Ionicons name="ellipse" size={12} color="#00AEEF" style={{marginRight: 10}} />
                  <View style={{flex: 1}}>
                    <Text style={{fontWeight: 'bold', fontSize: 15, color: themeText}}>{t.title}</Text>
                    <Text style={{fontSize: 12, color: themeSubText, marginTop: 3}}>Takım: {t.organizations.name}</Text>
                  </View>
                  <TouchableOpacity onPress={() => { setNotificationsModalVisible(false); navigation.navigate('Organizations'); }}>
                    <Ionicons name="chevron-forward-circle" size={28} color="#800000" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={menuVisible} animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setMenuVisible(false)}>
          <View style={[styles.menuContainer, { backgroundColor: themeCard }]}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setProfileModalVisible(true); }}><Ionicons name="person-outline" size={22} color={themeText} /><Text style={[styles.menuText, { color: themeText }]}>Profil Ayarları</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setStatsModalVisible(true); }}><Ionicons name="stats-chart-outline" size={22} color={themeText} /><Text style={[styles.menuText, { color: themeText }]}>Kişisel İstatistiklerim</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); navigation.navigate('Organizations'); }}><Ionicons name="people-outline" size={22} color={themeText} /><Text style={[styles.menuText, { color: themeText }]}>Takım / Organizasyonlar</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setPomodoroModalVisible(true); }}><Ionicons name="timer-outline" size={22} color="#00AEEF" /><Text style={[styles.menuText, { color: '#00AEEF', fontWeight: 'bold' }]}>Odak Modu (Pomodoro)</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={toggleTheme}><Ionicons name={isDarkMode ? "sunny-outline" : "moon-outline"} size={22} color={themeText} /><Text style={[styles.menuText, { color: themeText }]}>{isDarkMode ? "Açık Temaya Geç" : "Koyu Temaya Geç"}</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setChangePinModalVisible(true); }}><Ionicons name="lock-closed-outline" size={22} color={themeText} /><Text style={[styles.menuText, { color: themeText }]}>Günlük Şifresini Değiştir</Text></TouchableOpacity>
            <View style={[styles.menuDivider, { backgroundColor: isDarkMode ? '#444' : '#eee' }]} />
            <TouchableOpacity style={styles.menuItem} onPress={() => supabase.auth.signOut()}><Ionicons name="log-out-outline" size={22} color="red" /><Text style={[styles.menuText, { color: 'red', fontWeight: 'bold' }]}>Çıkış Yap</Text></TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={pomodoroModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalBox, { backgroundColor: themeCard, alignItems: 'center', paddingVertical: 50, borderWidth: 2, borderColor: pomodoroMode === 'focus' ? '#800000' : '#00AEEF' }]}>
            <Text style={{ fontSize: 22, fontWeight: 'bold', color: pomodoroMode === 'focus' ? '#800000' : '#00AEEF', letterSpacing: 2, marginBottom: 30 }}>{pomodoroMode === 'focus' ? 'ODAK ZAMANI' : 'MOLA ZAMANI'}</Text>
            <View style={{ width: 220, height: 220, borderRadius: 110, borderWidth: 8, borderColor: pomodoroMode === 'focus' ? '#800000' : '#00AEEF', alignItems: 'center', justifyContent: 'center', backgroundColor: isDarkMode ? '#111' : '#f9f9f9', shadowColor: pomodoroMode === 'focus' ? '#800000' : '#00AEEF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 15 }}>
              <Text style={{ fontSize: 58, fontWeight: 'bold', color: themeText, letterSpacing: 2 }}>{formatTime(pomodoroTime)}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 20, marginTop: 40 }}>
              <TouchableOpacity onPress={() => setIsPomodoroActive(!isPomodoroActive)} style={[styles.saveBtn, { backgroundColor: isPomodoroActive ? '#FF8C00' : 'green', paddingHorizontal: 40, paddingVertical: 18, borderRadius: 30 }]}><Text style={[styles.saveBtnText, { fontSize: 18 }]}>{isPomodoroActive ? 'DURDUR' : 'BAŞLAT'}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => { setIsPomodoroActive(false); setPomodoroTime(pomodoroMode === 'focus' ? 25 * 60 : 5 * 60); }} style={[styles.saveBtn, { backgroundColor: '#666', borderRadius: 30, paddingHorizontal: 20, paddingVertical: 18 }]}><Ionicons name="refresh" size={24} color="#fff" /></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => { setIsPomodoroActive(false); setPomodoroModalVisible(false); }} style={{ marginTop: 30 }}><Text style={{ color: '#888', fontSize: 16, fontWeight: 'bold' }}>Geri Dön</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={statsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalBox, { backgroundColor: themeCard, alignItems: 'center' }]}>
             <Ionicons name="stats-chart" size={50} color="#800000" style={{marginBottom: 10}} />
             <Text style={[styles.modalTitle, { color: themeText }]}>Kişisel İstatistiklerim</Text>
             <View style={{flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginVertical: 20}}>
                <View style={{alignItems: 'center'}}><Text style={{fontSize: 28, fontWeight: 'bold', color: themeText}}>{tasks.length}</Text><Text style={{fontSize: 12, color: themeSubText}}>Toplam Kayıt</Text></View>
                <View style={{alignItems: 'center'}}><Text style={{fontSize: 28, fontWeight: 'bold', color: 'green'}}>{completedTasksCount}</Text><Text style={{fontSize: 12, color: themeSubText}}>Tamamlanan</Text></View>
                <View style={{alignItems: 'center'}}><Text style={{fontSize: 28, fontWeight: 'bold', color: '#00AEEF'}}>{myProfile.total_focus_minutes || 0}</Text><Text style={{fontSize: 12, color: themeSubText}}>Dakika Odak</Text></View>
             </View>
             <TouchableOpacity onPress={() => setStatsModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Kapat</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={profileModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalBox, { backgroundColor: themeCard, width: '90%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: themeText }]}>Profil Ayarları</Text>
              <Text style={[styles.modalSubLabel, { color: themeSubText }]}>Kayıtlı E-Posta</Text>
              <TextInput style={[styles.editInput, { backgroundColor: isDarkMode ? '#333' : '#e6e6e6', color: themeSubText }]} value={myProfile.email || 'Mail çekiliyor...'} editable={false} />
              <Text style={[styles.modalSubLabel, { color: themeSubText }]}>Ad Soyad</Text>
              <TextInput style={[styles.editInput, { backgroundColor: themeInputBg, color: themeText }]} value={myProfile.full_name} onChangeText={(t) => setMyProfile({...myProfile, full_name: t})} />
              <Text style={[styles.modalSubLabel, { color: themeSubText }]}>Hakkımda</Text>
              <TextInput style={[styles.editInput, { backgroundColor: themeInputBg, color: themeText, minHeight: 80, textAlignVertical: 'top' }]} value={myProfile.bio} onChangeText={(t) => setMyProfile({...myProfile, bio: t})} placeholder="Örn: Yazılım, Mekanik..." multiline />
              <TouchableOpacity onPress={updateProfile} style={styles.saveBtn}><Text style={styles.saveBtnText}>Bilgileri Güncelle</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setProfileModalVisible(false)} style={{marginTop: 15, alignItems: 'center'}}><Text style={{color: '#888', fontWeight: 'bold'}}>Kapat</Text></TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={changePinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalBox, { backgroundColor: themeCard }]}>
            <Text style={[styles.modalTitle, {textAlign: 'center', color: themeText}]}>Günlük Şifresi Ayarla</Text>
            <TextInput style={[styles.editInput, { backgroundColor: themeInputBg, color: themeText, textAlign: 'center', fontSize: 24, letterSpacing: 10}]} secureTextEntry keyboardType="numeric" maxLength={4} value={newPinInput} onChangeText={setNewPinInput} autoFocus />
            <View style={styles.modalActionRow}>
              <TouchableOpacity onPress={() => {setChangePinModalVisible(false); setNewPinInput('');}} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>İptal</Text></TouchableOpacity>
              <TouchableOpacity onPress={saveNewPin} style={styles.saveBtn}><Text style={styles.saveBtnText}>Kaydet</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={pinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalBox, { backgroundColor: themeCard }]}>
            <Text style={[styles.modalTitle, {textAlign: 'center', color: themeText}]}>Günlük Şifreni Gir</Text>
            <TextInput style={[styles.editInput, {backgroundColor: themeInputBg, color: themeText, textAlign: 'center', fontSize: 24, letterSpacing: 10}]} secureTextEntry keyboardType="numeric" maxLength={4} value={enteredPin} onChangeText={setEnteredPin} autoFocus />
            <View style={styles.modalActionRow}>
              <TouchableOpacity onPress={() => setPinModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity onPress={verifyPin} style={styles.saveBtn}><Text style={styles.saveBtnText}>Giriş Yap</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal transparent visible={editModalVisible} animationType="slide">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalBox, { backgroundColor: themeCard, maxHeight: '80%' }]}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalTitle, { color: themeText }]}>{taskType} Detayları</Text>
              <Text style={[styles.modalSubLabel, { color: themeSubText }]}>Başlık</Text>
              <TextInput style={[styles.editInput, { backgroundColor: themeInputBg, color: themeText, fontSize: 16 }]} value={editTitle} onChangeText={setEditTitle} />
              <Text style={[styles.modalSubLabel, { color: themeSubText }]}>Notlar & Açıklama</Text>
              <TextInput style={[styles.editInput, { backgroundColor: themeInputBg, color: themeText, minHeight: 100, textAlignVertical: 'top' }]} value={editNotes} onChangeText={setEditNotes} multiline />
              <Text style={[styles.modalSubLabel, { color: themeSubText }]}>Alt Görevler</Text>
              <View style={{flexDirection: 'row', marginBottom: 10}}>
                <TextInput style={[styles.editInput, { backgroundColor: themeInputBg, color: themeText, flex: 1, marginBottom: 0, height: 48 }]} value={newSubtask} onChangeText={setNewSubtask} placeholder="Alt görev ekle..." placeholderTextColor={themeSubText} />
                <TouchableOpacity onPress={addSubtask} style={{backgroundColor: '#800000', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 10, marginLeft: 10}}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
              </View>
              {editSubtasks.map(st => (
                <View key={st.id} style={[styles.subtaskRow, { backgroundColor: themeInputBg, borderColor: isDarkMode ? '#444' : '#eee' }]}>
                  <TouchableOpacity onPress={() => toggleSubtask(st.id)}><Ionicons name={st.completed ? "checkbox" : "square-outline"} size={24} color={st.completed ? "green" : themeSubText} /></TouchableOpacity>
                  <Text style={[styles.subtaskText, { color: themeText }, st.completed && styles.taskCompletedText]}>{st.text}</Text>
                  <TouchableOpacity onPress={() => deleteSubtask(st.id)}><Ionicons name="close" size={20} color="red" /></TouchableOpacity>
                </View>
              ))}
              <View style={[styles.modalActionRow, {marginTop: 20}]}>
                <TouchableOpacity onPress={() => {setEditModalVisible(false); deleteTask(editingTask.id);}} style={styles.cancelBtn}><Text style={[styles.cancelBtnText, {color: 'red'}]}>Sil</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setEditModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>İptal</Text></TouchableOpacity>
                <TouchableOpacity onPress={saveEditTask} style={styles.saveBtn}><Text style={styles.saveBtnText}>Kaydet</Text></TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toastContainer: { position: 'absolute', top: 55, left: 20, right: 20, backgroundColor: '#2b2b2b', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', zIndex: 9999, elevation: 15 },
  toastTitle: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },
  toastMsg: { color: '#fff', fontSize: 14, marginTop: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, paddingTop: 60, paddingBottom: 10 },
  headerGreeting: { fontSize: 16, fontWeight: '500' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#800000' },
  profileIconContainer: { position: 'relative' },
  notificationDot: { position: 'absolute', top: 0, right: 0, width: 14, height: 14, backgroundColor: 'red', borderRadius: 7, borderWidth: 2, borderColor: '#f9f9f9' },
  dailyProgressBox: { marginHorizontal: 25, marginBottom: 5 },
  dailyProgressBarBg: { height: 8, borderRadius: 4, overflow: 'hidden' },
  dailyProgressBarFill: { height: '100%', backgroundColor: '#00AEEF', borderRadius: 4 },
  calendarWrapper: { marginHorizontal: 15, marginTop: 10, borderRadius: 15, overflow: 'hidden', elevation: 2 },
  quoteCard: { flexDirection: 'row', marginHorizontal: 20, marginTop: 15, marginBottom: 15, padding: 15, borderRadius: 12, alignItems: 'center', elevation: 2, borderLeftWidth: 4, borderLeftColor: '#FFD700' },
  quoteText: { fontStyle: 'italic', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  typeSelector: { flexDirection: 'row', justifyContent: 'center', marginBottom: 15, gap: 10, flexWrap: 'wrap' },
  typeBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20 },
  typeBtnText: { fontSize: 14, fontWeight: '500' },
  activeTypeText: { color: '#fff', fontWeight: 'bold' },
  inputCard: { flexDirection: 'row', marginHorizontal: 20, padding: 8, borderRadius: 15, alignItems: 'center', elevation: 4, marginBottom: 15 },
  input: { flex: 1, paddingHorizontal: 15, fontSize: 16 },
  addBtn: { backgroundColor: '#800000', width: 48, height: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  aiBtn: { backgroundColor: '#2b2b2b', marginHorizontal: 20, padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 15, elevation: 3 },
  aiBtnText: { color: '#FFD700', fontWeight: 'bold', fontSize: 15 },
  emptyStateContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
  emptyStateText: { fontSize: 15, marginTop: 15, textAlign: 'center', paddingHorizontal: 40, fontStyle: 'italic' },
  taskItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 12, padding: 18, borderRadius: 15, borderLeftWidth: 5, borderLeftColor: '#800000', elevation: 2 },
  taskCompletedItem: { opacity: 0.6, borderLeftColor: 'green' },
  taskTitle: { fontSize: 17, fontWeight: '600' },
  taskCompletedText: { textDecorationLine: 'line-through', color: '#888' },
  lockedTaskItem: { marginHorizontal: 20, marginBottom: 12, paddingVertical: 25, borderRadius: 15, alignItems: 'center', justifyContent: 'center', elevation: 3, borderWidth: 1, borderColor: '#444' },
  lockedTaskText: { color: '#888', fontStyle: 'italic', marginTop: 10, fontSize: 13, fontWeight: 'bold' },
  progressBarContainer: { height: 6, borderRadius: 3, marginTop: 8, width: '100%', overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 3 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  menuContainer: { position: 'absolute', top: 110, right: 25, width: 260, borderRadius: 20, paddingVertical: 15, elevation: 15 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 20 },
  menuText: { marginLeft: 15, fontSize: 16, fontWeight: '500' },
  menuDivider: { height: 1, marginVertical: 5, marginHorizontal: 20 },
  editModalBox: { width: '90%', padding: 25, borderRadius: 20, elevation: 10 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 5 },
  modalSubLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 5, marginTop: 10 },
  editInput: { borderRadius: 12, padding: 15, marginBottom: 10, fontSize: 16, borderWidth: 1, borderColor: 'transparent' },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, marginBottom: 5, borderWidth: 1 },
  subtaskText: { flex: 1, marginLeft: 10, fontSize: 15 },
  modalActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 15, alignItems: 'center', marginTop: 15 },
  cancelBtn: { padding: 10 },
  cancelBtnText: { color: '#888', fontWeight: 'bold', fontSize: 16 },
  saveBtn: { backgroundColor: '#800000', paddingHorizontal: 25, paddingVertical: 12, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 }
});