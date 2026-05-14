import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Alert, Modal, ScrollView, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

const GEMINI_API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

export default function OrganizationScreen({ navigation }) {
  const [currentUserId, setCurrentUserId] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [myOrgs, setMyOrgs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [newOrgName, setNewOrgName] = useState('');
  
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [selectedOrgRole, setSelectedOrgRole] = useState('member'); 
  const [members, setMembers] = useState([]);
  const [orgTasks, setOrgTasks] = useState([]); 
  
  const [teamStats, setTeamStats] = useState({ total: 0, todo: 0, inProgress: 0, review: 0, done: 0 });
  const [taskFilter, setTaskFilter] = useState('all'); 
  const [activeOrgTab, setActiveOrgTab] = useState('görevler'); 

  const [modalVisible, setModalVisible] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState(null);

  const [taskDetailModalVisible, setTaskDetailModalVisible] = useState(false);
  const [activeTask, setActiveTask] = useState(null);
  const [activeTaskTitle, setActiveTaskTitle] = useState('');
  const [activeTaskNotes, setActiveTaskNotes] = useState('');
  const [activeTaskStatus, setActiveTaskStatus] = useState('To-Do');
  const [activeTaskDeadline, setActiveTaskDeadline] = useState('');
  const [activeTaskSubtasks, setActiveTaskSubtasks] = useState([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [aiSubtaskLoading, setAiSubtaskLoading] = useState(false);
  const [aiAssignLoading, setAiAssignLoading] = useState(false);
  const [aiScrumLoading, setAiScrumLoading] = useState(false);
  
  const [taskComments, setTaskComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [taskFiles, setTaskFiles] = useState([]);
  const [fileVersion, setFileVersion] = useState('v1.0');
  const [activeTab, setActiveTab] = useState('detay'); 
  const [uploading, setUploading] = useState(false);

  const [orgResources, setOrgResources] = useState([]);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceCost, setNewResourceCost] = useState('');

  const [orgMeetings, setOrgMeetings] = useState([]);
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [newMeetingContent, setNewMeetingContent] = useState('');
  const [aiMeetingLoading, setAiMeetingLoading] = useState(false);

  const [orgPolls, setOrgPolls] = useState([]);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOption1, setNewPollOption1] = useState('');
  const [newPollOption2, setNewPollOption2] = useState('');

  const [responseModalVisible, setResponseModalVisible] = useState(false);
  const [activeInvite, setActiveInvite] = useState(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [responseType, setResponseType] = useState(null);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [globalStats, setGlobalStats] = useState({ activeGroups: 0, totalPending: 0 });

  const [toastVisible, setToastVisible] = useState(false);
  const [toastData, setToastData] = useState({ title: '', message: '' });

  const showToast = (title, message) => {
    setToastData({ title, message });
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 4000);
  };

  const statuses = ['To-Do', 'In Progress', 'Review', 'Done'];

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    if (!currentUserId || !selectedOrg) return;

    const taskSub = supabase.channel('public:tasks')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tasks', filter: `org_id=eq.${selectedOrg.id}` }, payload => {
         if(payload.new.assigned_to === currentUserId && payload.new.user_id !== currentUserId) {
             showToast('🔔 Yeni Görev', `Sana bir görev atandı: ${payload.new.title}`);
         }
      }).subscribe();

    const msgSub = supabase.channel('public:org_messages')
       .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'org_messages', filter: `org_id=eq.${selectedOrg.id}` }, payload => {
           fetchMessages(selectedOrg.id); 
           if(payload.new.user_id !== currentUserId) {
               const isAi = payload.new.message.includes('[🤖 AI Asistan]');
               showToast(isAi ? '🤖 AI Scrum Master' : '💬 Yeni Mesaj', isAi ? 'Takıma yeni bir yönlendirme geldi!' : 'Sohbete yeni bir mesaj yazıldı.');
           }
       }).subscribe();

    return () => { supabase.removeChannel(taskSub); supabase.removeChannel(msgSub); }
  }, [currentUserId, selectedOrg]);

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    
    const { data: profileData } = await supabase.from('profiles').select('theme_preference').eq('id', user.id).single();
    if (profileData && profileData.theme_preference === 'dark') { setIsDarkMode(true); } else { setIsDarkMode(false); }
    
    const { data: orgs } = await supabase.from('organization_members').select('organizations(*)').eq('user_id', user.id).eq('status', 'accepted');
    const validOrgs = orgs?.map(o => o.organizations).filter(Boolean) || [];
    setMyOrgs(validOrgs);

    const { data: invs } = await supabase.from('organization_members').select('id, organizations(name, id), invite_message').eq('user_id', user.id).eq('status', 'pending');
    setInvites(invs || []);
    setGlobalStats({ activeGroups: validOrgs.length, totalPending: (invs || []).length });
  };

  const createOrg = async () => {
    if (!newOrgName.trim()) return;
    const { data, error } = await supabase.from('organizations').insert([{ name: newOrgName, created_by: currentUserId }]).select().single();
    if (!error && data) {
      await supabase.from('organization_members').insert([{ org_id: data.id, user_id: currentUserId, status: 'accepted', role: 'admin' }]);
      setNewOrgName(''); fetchAll();
    } else Alert.alert("Hata", error.message);
  };

  const openOrgDetails = async (org) => {
    setSelectedOrg(org);
    setTaskFilter('all'); 
    setActiveOrgTab('görevler');
    
    const { data } = await supabase.from('organization_members').select('user_id, role, profiles(full_name, phone_number, bio), status, invite_message, response_message').eq('org_id', org.id);
    setMembers(data || []);
    const me = data?.find(m => String(m.user_id) === String(currentUserId));
    setSelectedOrgRole(String(org.created_by) === String(currentUserId) ? 'admin' : (me?.role || 'member'));

    fetchOrgTasks(org.id); fetchMessages(org.id); fetchOrgResources(org.id); fetchOrgMeetings(org.id); fetchOrgPolls(org.id);
    setModalVisible(true);
  };

  const fetchOrgPolls = async (orgId) => {
    const { data } = await supabase.from('org_polls').select(`*, profiles!org_polls_created_by_fkey(full_name), org_poll_options(*), org_poll_votes(option_id, user_id)`).eq('org_id', orgId).order('created_at', { ascending: false });
    setOrgPolls(data || []);
  };

  const createPoll = async () => {
    if (!newPollQuestion.trim() || !newPollOption1.trim() || !newPollOption2.trim()) return Alert.alert("Hata", "Soru ve en az iki seçenek girmelisin.");
    const { data: poll, error } = await supabase.from('org_polls').insert([{ org_id: selectedOrg.id, question: newPollQuestion, created_by: currentUserId }]).select().single();
    if (poll && !error) {
      await supabase.from('org_poll_options').insert([{ poll_id: poll.id, option_text: newPollOption1 }, { poll_id: poll.id, option_text: newPollOption2 }]);
      setNewPollQuestion(''); setNewPollOption1(''); setNewPollOption2(''); fetchOrgPolls(selectedOrg.id);
    }
  };

  const castVote = async (pollId, optionId) => {
    await supabase.from('org_poll_votes').delete().eq('poll_id', pollId).eq('user_id', currentUserId);
    await supabase.from('org_poll_votes').insert([{ poll_id: pollId, option_id: optionId, user_id: currentUserId }]);
    fetchOrgPolls(selectedOrg.id);
  };

  const fetchMessages = async (orgId) => {
    const { data } = await supabase.from('org_messages').select('*, profiles(full_name)').eq('org_id', orgId).order('created_at', { ascending: true });
    setMessages(data || []);
  };

  const fetchOrgResources = async (orgId) => {
    const { data } = await supabase.from('org_resources').select('*, profiles(full_name)').eq('org_id', orgId).order('created_at', { ascending: false });
    setOrgResources(data || []);
  };

  const fetchOrgMeetings = async (orgId) => {
    const { data } = await supabase.from('org_meetings').select('*, profiles(full_name)').eq('org_id', orgId).order('created_at', { ascending: false });
    setOrgMeetings(data || []);
  };

  const fetchOrgTasks = async (orgId) => {
    const { data } = await supabase.from('tasks').select('*, assignee_profile:profiles!tasks_assigned_to_fkey(full_name)').eq('org_id', orgId).order('created_at', {ascending: false});
    setOrgTasks(data || []);
    if (data) {
      setTeamStats({
        total: data.length, todo: data.filter(t => t.status === 'To-Do' || !t.status).length,
        inProgress: data.filter(t => t.status === 'In Progress').length,
        review: data.filter(t => t.status === 'Review').length, done: data.filter(t => t.status === 'Done' || t.is_completed).length
      });
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const { error } = await supabase.from('org_messages').insert([{ org_id: selectedOrg.id, user_id: currentUserId, message: newMessage }]);
    if (!error) { setNewMessage(''); fetchMessages(selectedOrg.id); }
  };

  const addResource = async () => {
    if(!newResourceName) return;
    await supabase.from('org_resources').insert([{ org_id: selectedOrg.id, name: newResourceName, cost: parseFloat(newResourceCost) || 0, user_id: currentUserId, status: 'Bekliyor' }]);
    setNewResourceName(''); setNewResourceCost(''); fetchOrgResources(selectedOrg.id);
  };

  const cycleResourceStatus = async (res) => {
    const next = res.status === 'Bekliyor' ? 'Alındı' : (res.status === 'Alındı' ? 'İptal' : 'Bekliyor');
    await supabase.from('org_resources').update({status: next}).eq('id', res.id); fetchOrgResources(selectedOrg.id);
  };

  const deleteResource = async (id) => { await supabase.from('org_resources').delete().eq('id', id); fetchOrgResources(selectedOrg.id); };

  const removeMember = async (userId) => {
    Alert.alert("Üyeyi Çıkar", "Emin misin?", [
      { text: "İptal", style: "cancel" },
      { text: "Çıkar", style: "destructive", onPress: async () => {
          await supabase.from('organization_members').delete().eq('org_id', selectedOrg.id).eq('user_id', userId);
          const { data } = await supabase.from('organization_members').select('user_id, role, profiles(full_name, phone_number, bio), status').eq('org_id', selectedOrg.id);
          setMembers(data || []);
      }}
    ]);
  };

  // GEMİNİ 2.0 FLASH BURADA
  const saveMeetingWithAI = async () => {
    if(!newMeetingTitle || !newMeetingContent) return Alert.alert("Hata", "Başlık ve içerik girin.");
    setAiMeetingLoading(true);
    try {
       const prompt = `Sen bir yönetici asistansın. Aşağıdaki toplantı tutanağını analiz et. Toplantıda alınan kararları ve çıkarılan görevleri çok kısa, net ve profesyonel maddeler halinde özetle:\n\n${newMeetingContent}`;
       const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
       });
       const data = await response.json();
       const summary = data.candidates[0].content.parts[0].text.trim();
       await supabase.from('org_meetings').insert([{ org_id: selectedOrg.id, title: newMeetingTitle, content: newMeetingContent, summary: summary, created_by: currentUserId }]);
       setNewMeetingTitle(''); setNewMeetingContent(''); fetchOrgMeetings(selectedOrg.id);
       Alert.alert("Başarılı", "Tutanak kaydedildi ve AI tarafından özetlendi! ✨");
    } catch(e) { Alert.alert("Hata", "Özetleme başarısız oldu."); } finally { setAiMeetingLoading(false); }
  };

  const triggerScrumMasterAI = async () => {
    setAiScrumLoading(true);
    try {
      const pendingTasks = orgTasks.filter(t => t.status !== 'Done').map(t => `- ${t.title} (${t.assignee_profile?.full_name || 'Atanmadı'})`).join('\n');
      const prompt = `Sen bir mühendislik projesi Scrum Master'ısın. Takımın şu anki durumu: ${teamStats.done} biten, ${teamStats.inProgress} devam eden görev var. Bekleyen görevler:\n${pendingTasks}\n\nTakıma Türkçe, motive edici, çok kısa bir özet ve tatlı sert bir hatırlatma yaz. Mesaj "Günaydın Takım!" diye başlasın.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      await supabase.from('org_messages').insert([{ org_id: selectedOrg.id, user_id: currentUserId, message: `[🤖 AI Asistan]: ${data.candidates[0].content.parts[0].text.trim()}` }]);
      fetchMessages(selectedOrg.id);
    } catch (error) { Alert.alert("Hata", "AI Asistanı çağrılamadı."); } finally { setAiScrumLoading(false); }
  };

  const suggestAssigneeWithAI = async () => {
    if (!newTaskTitle.trim()) return Alert.alert("Uyarı", "Önce bir görev başlığı girin!");
    setAiAssignLoading(true);
    try {
      const activeMembers = members.filter(m => m.status === 'accepted');
      const membersStr = activeMembers.map(m => `ID: ${m.user_id}, İsim: ${m.profiles?.full_name}, Bio: ${m.profiles?.bio || 'Belirtilmedi'}`).join('\n');
      const prompt = `Görev adı: "${newTaskTitle}". Ekip üyeleri ve biyografileri:\n${membersStr}\nBu görevi yeteneklerine göre kime atamalıyım? Lütfen SADECE en uygun kişinin ID'sini yaz. Başka kelime yazma.`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      const matchedMember = activeMembers.find(m => m.user_id === data.candidates[0].content.parts[0].text.trim());
      if (matchedMember) {
        setSelectedAssignee(matchedMember.user_id); Alert.alert("Yapay Zeka", `Görev ${matchedMember.profiles?.full_name} için uygun görüldü! 🧠`);
      } else Alert.alert("Bilgi", "Uygun eşleşme bulunamadı.");
    } catch (error) { Alert.alert("Hata", "Atama çalışmadı."); } finally { setAiAssignLoading(false); }
  };

  const generateSubtasksWithAI = async () => {
    if (!activeTaskTitle.trim()) return;
    setAiSubtaskLoading(true);
    try {
      const prompt = `Görevin adı: "${activeTaskTitle}". Mantıksal 3-4 maddelik alt adımlar (checklist) oluştur. Sadece maddeleri yaz, aralarına '|' (pipe) işareti koy. Örnek: Malzeme seçimi|Statik analiz|Çizim çıktısı`;
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
      });
      const data = await response.json();
      const newAiSubtasks = data.candidates[0].content.parts[0].text.trim().split('|').map(text => ({ id: Date.now().toString() + Math.random().toString(36).substr(2, 5), text: text.trim(), completed: false })).filter(st => st.text.length > 0);
      setActiveTaskSubtasks([...activeTaskSubtasks, ...newAiSubtasks]);
      Alert.alert("Yapay Zeka", "Görev başarıyla alt adımlara parçalandı! ✨");
    } catch (error) { Alert.alert("Hata", "Parçalama başarısız."); } finally { setAiSubtaskLoading(false); }
  };

  const addSubtask = () => { if(!newSubtask.trim()) return; setActiveTaskSubtasks([...activeTaskSubtasks, { id: Date.now().toString(), text: newSubtask, completed: false }]); setNewSubtask(''); };
  const toggleSubtask = (id) => setActiveTaskSubtasks(activeTaskSubtasks.map(st => st.id === id ? { ...st, completed: !st.completed } : st));
  const deleteSubtask = (id) => setActiveTaskSubtasks(activeTaskSubtasks.filter(st => st.id !== id));

  const addOrgTask = async () => {
    if (selectedOrgRole !== 'admin') return Alert.alert("Yetki Yok", "Sadece yöneticiler görev atayabilir.");
    if (!newTaskTitle.trim()) return;
    const { error } = await supabase.from('tasks').insert([{ 
      user_id: currentUserId, title: newTaskTitle, category: 'Proje', org_id: selectedOrg.id, 
      assigned_to: selectedAssignee || currentUserId, is_completed: false, status: 'To-Do', deadline: new Date().toISOString().split('T')[0], notes: '', subtasks: []
    }]);
    if (!error) { setNewTaskTitle(''); setSelectedAssignee(null); fetchOrgTasks(selectedOrg.id); } else Alert.alert("Hata", error.message);
  };

  const fetchTaskComments = async (taskId) => {
    const { data } = await supabase.from('task_comments').select('*, profiles(full_name)').eq('task_id', taskId).order('created_at', { ascending: true });
    setTaskComments(data || []);
  };
  const addTaskComment = async () => {
    if (!newComment.trim()) return;
    await supabase.from('task_comments').insert([{ task_id: activeTask.id, user_id: currentUserId, comment: newComment }]);
    setNewComment(''); fetchTaskComments(activeTask.id);
  };

  const fetchTaskFiles = async (taskId) => {
    const { data } = await supabase.from('task_files').select('*').eq('task_id', taskId);
    setTaskFiles(data || []);
  };

  const handleFileUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
      if (result.canceled) return;
      setUploading(true);
      const file = result.assets[0];
      const fileName = `${Date.now()}.${file.name.split('.').pop()}`;
      const filePath = `${activeTask.id}/${fileName}`;
      const formData = new FormData();
      formData.append('file', { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
      
      const { error: uploadError } = await supabase.storage.from('task-files').upload(filePath, formData);
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('task-files').getPublicUrl(filePath);

      await supabase.from('task_files').insert([{ task_id: activeTask.id, user_id: currentUserId, file_name: file.name, file_url: publicUrlData.publicUrl, version: fileVersion }]);
      fetchTaskFiles(activeTask.id); setFileVersion('v1.0'); Alert.alert("Başarılı", "Dosya yüklendi!");
    } catch (error) { Alert.alert("Yükleme Hatası", "Dosya yüklenemedi."); } finally { setUploading(false); }
  };

  const openTaskDetails = (task) => {
    setActiveTask(task); setActiveTaskTitle(task.title); setActiveTaskNotes(task.notes || '');
    setActiveTaskStatus(task.status || 'To-Do'); setActiveTaskDeadline(task.deadline || '');
    setActiveTaskSubtasks(task.subtasks || []); setActiveTab('detay');
    fetchTaskComments(task.id); fetchTaskFiles(task.id); setTaskDetailModalVisible(true);
  };

  const updateTaskDetails = async () => {
    const isCompleted = activeTaskStatus === 'Done' || (activeTaskSubtasks.length > 0 && activeTaskSubtasks.every(st => st.completed));
    await supabase.from('tasks').update({ 
      title: activeTaskTitle, notes: activeTaskNotes, status: isCompleted ? 'Done' : activeTaskStatus,
      is_completed: isCompleted, deadline: activeTaskDeadline, subtasks: activeTaskSubtasks
    }).eq('id', activeTask.id);
    setTaskDetailModalVisible(false); fetchOrgTasks(selectedOrg.id);
  };

  const deleteOrgTask = async () => { await supabase.from('tasks').delete().eq('id', activeTask.id); setTaskDetailModalVisible(false); fetchOrgTasks(selectedOrg.id); };

  const leaveOrg = async () => {
    Alert.alert("Ayrıl", `${selectedOrg.name} grubundan ayrılmak istediğine emin misin?`, [
      { text: "İptal", style: "cancel" }, { text: "Ayrıl", style: "destructive", onPress: async () => {
          await supabase.from('organization_members').update({ status: 'left' }).eq('org_id', selectedOrg.id).eq('user_id', currentUserId);
          setModalVisible(false); fetchAll();
      }}
    ]);
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return Alert.alert("Hata", "Lütfen davet edilecek kişinin e-posta adresini girin.");
    const { data: { user } } = await supabase.auth.getUser();
    if (inviteEmail.trim().toLowerCase() === user.email) return Alert.alert("Hata", "Kendinizi davet edemezsiniz!");

    const { error } = await supabase.rpc('add_user_to_org_by_email', { target_email: inviteEmail.trim().toLowerCase(), target_org_id: selectedOrg.id, invite_msg: inviteMessage });
    if (!error) { Alert.alert("Başarılı", "Davet başarıyla gönderildi!"); setInviteEmail(''); setInviteMessage(''); openOrgDetails(selectedOrg); } else Alert.alert("Hata", "Kullanıcı bulunamadı.");
  };

  const submitInviteResponse = async () => {
    const finalStatus = responseType === 'accept' ? 'accepted' : 'rejected';
    await supabase.from('organization_members').update({ status: finalStatus, response_message: responseMessage }).eq('org_id', activeInvite.organizations.id).eq('user_id', currentUserId);
    setResponseModalVisible(false); setResponseMessage(''); setActiveInvite(null); fetchAll();
  };

  const filteredTasks = taskFilter === 'mine' ? orgTasks.filter(t => t.assigned_to === currentUserId) : orgTasks;
  const getStatusColor = (status) => { switch(status) { case 'Done': return 'green'; case 'Review': return '#FF8C00'; case 'In Progress': return '#00AEEF'; default: return '#ccc'; }};
  const totalExpense = orgResources.filter(r => r.status === 'Alındı').reduce((a,b) => a + Number(b.cost), 0).toFixed(2);
  const pendingExpense = orgResources.filter(r => r.status === 'Bekliyor').reduce((a,b) => a + Number(b.cost), 0).toFixed(2);

  const themeBg = isDarkMode ? '#121212' : '#f9f9f9';
  const themeCard = isDarkMode ? '#1E1E1E' : '#fff';
  const themeText = isDarkMode ? '#E0E0E0' : '#333';
  const themeSubText = isDarkMode ? '#A0A0A0' : '#666';
  const themeInputBg = isDarkMode ? '#2C2C2C' : '#f9f9f9';
  const themeBorder = isDarkMode ? '#444' : '#ddd';
  const themeSecondaryBg = isDarkMode ? '#2C2C2C' : '#f0f0f0';

  return (
    <View style={[styles.container, { backgroundColor: themeBg }]}>
      {toastVisible && (
        <View style={styles.toastContainer}>
          <Ionicons name="notifications" size={24} color="#fff" />
          <View style={{marginLeft: 12, flex: 1}}>
            <Text style={styles.toastTitle}>{toastData.title}</Text>
            <Text style={styles.toastMsg}>{toastData.message}</Text>
          </View>
          <TouchableOpacity onPress={() => setToastVisible(false)}><Ionicons name="close" size={20} color="#fff" /></TouchableOpacity>
        </View>
      )}

      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}><Ionicons name="arrow-back" size={28} color="#800000" /></TouchableOpacity>
        <Text style={styles.title}>Takım & Projeler</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.globalDashCard}>
          <Text style={styles.globalDashTitle}>Genel Bakış</Text>
          <View style={{flexDirection: 'row', justifyContent: 'space-around', marginTop: 10}}>
            <View style={{alignItems: 'center'}}><Text style={styles.globalDashNum}>{globalStats.activeGroups}</Text><Text style={styles.globalDashLabel}>Aktif Takım</Text></View>
            <View style={{alignItems: 'center'}}><Text style={[styles.globalDashNum, {color: 'orange'}]}>{globalStats.totalPending}</Text><Text style={styles.globalDashLabel}>Bekleyen Davet</Text></View>
          </View>
        </View>

        {invites.length > 0 && (
          <View style={[styles.inviteBox, { backgroundColor: themeCard }]}>
            <Text style={[styles.sub, { color: themeText }]}>Yeni Davetler</Text>
            {invites.map(i => (
              <View key={i.id} style={[styles.inviteCard, { borderBottomColor: themeBorder }]}>
                <View style={{flex:1}}><Text style={[styles.inviteOrgName, { color: themeText }]}>{i.organizations.name}</Text>{i.invite_message ? <Text style={[styles.inviteMsgText, { color: themeSubText }]}>"{i.invite_message}"</Text> : null}</View>
                <TouchableOpacity onPress={() => {setActiveInvite(i); setResponseType('accept'); setResponseModalVisible(true);}} style={{marginRight: 10}}><Ionicons name="checkmark-circle" size={36} color="green" /></TouchableOpacity>
                <TouchableOpacity onPress={() => {setActiveInvite(i); setResponseType('reject'); setResponseModalVisible(true);}}><Ionicons name="close-circle" size={36} color="red" /></TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.sub, { color: themeText }]}>Yeni Takım Kur</Text>
        <View style={styles.createRow}>
          <TextInput style={[styles.input, { backgroundColor: themeCard, color: themeText, borderColor: themeBorder }]} placeholder="Takım ismini gir..." placeholderTextColor={themeSubText} value={newOrgName} onChangeText={setNewOrgName} />
          <TouchableOpacity onPress={createOrg} style={{marginLeft: 10}}><Ionicons name="add-circle" size={45} color="#800000" /></TouchableOpacity>
        </View>

        <Text style={[styles.sub, { color: themeText }]}>Aktif Takımlarım</Text>
        {myOrgs.length === 0 && <Text style={{color: themeSubText, marginBottom: 20}}>Henüz bir takıma dahil değilsin.</Text>}
        {myOrgs.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.orgItem, { backgroundColor: themeCard }]} onPress={() => openOrgDetails(item)}>
            <View style={styles.orgIconBg}><Ionicons name="rocket-outline" size={20} color="#fff" /></View>
            <Text style={[styles.orgText, { color: themeText }]}>{item.name}</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide">
        <View style={[styles.modalContent, { backgroundColor: themeBg }]}>
          
          <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={32} color={themeText} /></TouchableOpacity>
            <View style={{flexDirection: 'row', alignItems: 'center', gap: 15}}>
               <TouchableOpacity onPress={leaveOrg} style={styles.leaveBtn}><Ionicons name="exit-outline" size={18} color="red" /></TouchableOpacity>
            </View>
          </View>
          
          <Text style={styles.modalTitle}>{selectedOrg?.name}</Text>
          <Text style={{color: themeSubText, marginBottom: 15, fontSize: 13}}>Rolün: {selectedOrgRole === 'admin' ? 'Yönetici 👑' : 'Üye'}</Text>
          
          <View style={{ minHeight: 45, marginBottom: 15 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20, alignItems: 'center', gap: 8 }}>
              <TouchableOpacity onPress={() => setActiveOrgTab('görevler')} style={[styles.mainTabBtn, { backgroundColor: activeOrgTab === 'görevler' ? '#800000' : themeSecondaryBg }]}><Ionicons name="list" size={16} color={activeOrgTab === 'görevler' ? '#fff' : themeSubText} /><Text style={[styles.mainTabText, { color: activeOrgTab === 'görevler' ? '#fff' : themeSubText }]}>Görevler</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveOrgTab('butce')} style={[styles.mainTabBtn, { backgroundColor: activeOrgTab === 'butce' ? '#800000' : themeSecondaryBg }]}><Ionicons name="wallet" size={16} color={activeOrgTab === 'butce' ? '#fff' : themeSubText} /><Text style={[styles.mainTabText, { color: activeOrgTab === 'butce' ? '#fff' : themeSubText }]}>Bütçe</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveOrgTab('tutanak')} style={[styles.mainTabBtn, { backgroundColor: activeOrgTab === 'tutanak' ? '#800000' : themeSecondaryBg }]}><Ionicons name="document-text" size={16} color={activeOrgTab === 'tutanak' ? '#fff' : themeSubText} /><Text style={[styles.mainTabText, { color: activeOrgTab === 'tutanak' ? '#fff' : themeSubText }]}>Tutanaklar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveOrgTab('sohbet')} style={[styles.mainTabBtn, { backgroundColor: activeOrgTab === 'sohbet' ? '#800000' : themeSecondaryBg }]}><Ionicons name="chatbubbles" size={16} color={activeOrgTab === 'sohbet' ? '#fff' : themeSubText} /><Text style={[styles.mainTabText, { color: activeOrgTab === 'sohbet' ? '#fff' : themeSubText }]}>Sohbet</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveOrgTab('anket')} style={[styles.mainTabBtn, { backgroundColor: activeOrgTab === 'anket' ? '#800000' : themeSecondaryBg }]}><Ionicons name="stats-chart" size={16} color={activeOrgTab === 'anket' ? '#fff' : themeSubText} /><Text style={[styles.mainTabText, { color: activeOrgTab === 'anket' ? '#fff' : themeSubText }]}>Anketler</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveOrgTab('takvim')} style={[styles.mainTabBtn, { backgroundColor: activeOrgTab === 'takvim' ? '#800000' : themeSecondaryBg }]}><Ionicons name="calendar" size={16} color={activeOrgTab === 'takvim' ? '#fff' : themeSubText} /><Text style={[styles.mainTabText, { color: activeOrgTab === 'takvim' ? '#fff' : themeSubText }]}>Z. Çizelgesi</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveOrgTab('uyeler')} style={[styles.mainTabBtn, { backgroundColor: activeOrgTab === 'uyeler' ? '#800000' : themeSecondaryBg }]}><Ionicons name="people" size={16} color={activeOrgTab === 'uyeler' ? '#fff' : themeSubText} /><Text style={[styles.mainTabText, { color: activeOrgTab === 'uyeler' ? '#fff' : themeSubText }]}>Üyeler</Text></TouchableOpacity>
            </ScrollView>
          </View>

          {activeOrgTab === 'uyeler' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedOrgRole === 'admin' && (
                <View style={[styles.dashboardCard, { backgroundColor: themeInputBg, borderColor: themeBorder }]}>
                  <Text style={[styles.dashTitle, {color: '#800000', marginBottom: 5}]}>Yeni Üye Davet Et</Text>
                  <Text style={{color: themeSubText, fontSize: 12, marginBottom: 15}}>Takım arkadaşının sisteme kayıtlı olduğu e-posta adresini gir.</Text>
                  <TextInput style={[styles.modalInput, { backgroundColor: themeCard, color: themeText, borderColor: themeBorder }]} placeholder="Örn: pinar@deneme.com" placeholderTextColor={themeSubText} value={inviteEmail} onChangeText={setInviteEmail} autoCapitalize="none" keyboardType="email-address" />
                  <TextInput style={[styles.modalInput, {marginTop: 10, backgroundColor: themeCard, color: themeText, borderColor: themeBorder }]} placeholder="Davet Mesajı (Opsiyonel)" placeholderTextColor={themeSubText} value={inviteMessage} onChangeText={setInviteMessage} />
                  <TouchableOpacity onPress={sendInvite} style={[styles.saveBtn, {marginTop: 15, alignSelf: 'flex-start'}]}>
                    <Text style={styles.saveBtnText}>Davet Gönder</Text>
                  </TouchableOpacity>
                </View>
              )}
              <Text style={[styles.sectionTitle, { color: themeText }]}>Mevcut Takım Üyeleri</Text>
              {members.map(m => (
                <View key={m.user_id} style={[styles.memberCard, { backgroundColor: themeInputBg, borderColor: themeBorder }]}>
                  <Ionicons name="person-circle" size={45} color="#800000" />
                  <View style={{marginLeft: 15, flex: 1}}>
                    <Text style={{fontWeight: 'bold', fontSize: 16, color: themeText}}>{m.profiles?.full_name || 'İsimsiz Üye'}</Text>
                    <Text style={{fontSize: 12, color: '#00AEEF', fontWeight: 'bold'}}>{m.role === 'admin' ? 'Yönetici 👑' : 'Üye'}</Text>
                    {m.profiles?.bio ? <Text style={{fontSize: 12, color: themeSubText, fontStyle: 'italic', marginTop: 4}}>{m.profiles?.bio}</Text> : null}
                  </View>
                  {selectedOrgRole === 'admin' && m.user_id !== currentUserId && (
                    <TouchableOpacity onPress={() => removeMember(m.user_id)} style={{padding: 8}}><Ionicons name="person-remove" size={22} color="red" /></TouchableOpacity>
                  )}
                </View>
              ))}
            </ScrollView>
          )}

          {activeOrgTab === 'görevler' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.tabContainer, { backgroundColor: themeSecondaryBg }]}>
                <TouchableOpacity onPress={() => setTaskFilter('all')} style={[styles.tabBtn, taskFilter === 'all' && { backgroundColor: themeCard, elevation: 2 }]}><Text style={[styles.tabText, { color: taskFilter === 'all' ? '#800000' : themeSubText }]}>Takım Geneli</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => setTaskFilter('mine')} style={[styles.tabBtn, taskFilter === 'mine' && { backgroundColor: themeCard, elevation: 2 }]}><Text style={[styles.tabText, { color: taskFilter === 'mine' ? '#800000' : themeSubText }]}>Sorumluluklarım</Text></TouchableOpacity>
              </View>

              <View style={[styles.dashboardCard, { backgroundColor: themeInputBg, borderColor: themeBorder }]}>
                <Text style={[styles.dashTitle, { color: themeText }]}>Proje Durumu (Kanban İstatistikleri)</Text>
                <View style={{flexDirection: 'row', height: 15, backgroundColor: isDarkMode ? '#444' : '#eee', borderRadius: 8, overflow: 'hidden', marginBottom: 10}}>
                  <View style={{flex: teamStats.todo || 0, backgroundColor: '#ccc'}} />
                  <View style={{flex: teamStats.inProgress || 0, backgroundColor: '#00AEEF'}} />
                  <View style={{flex: teamStats.review || 0, backgroundColor: '#FF8C00'}} />
                  <View style={{flex: teamStats.done || 0, backgroundColor: 'green'}} />
                </View>
                <View style={{flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap'}}>
                  <Text style={{fontSize: 12, color: themeSubText}}>Gri: Yapılacak ({teamStats.todo})</Text>
                  <Text style={{fontSize: 12, color: '#00AEEF'}}>Mavi: Devam Ediyor ({teamStats.inProgress})</Text>
                  <Text style={{fontSize: 12, color: '#FF8C00'}}>Turuncu: İncelemede ({teamStats.review})</Text>
                  <Text style={{fontSize: 12, color: 'green'}}>Yeşil: Tamamlandı ({teamStats.done})</Text>
                </View>
              </View>

              {selectedOrgRole === 'admin' && (
                <View style={{marginBottom: 15, marginTop: 15}}>
                    <Text style={[styles.sectionTitle, { color: themeText }]}>Yeni Görev Ata</Text>
                    <View style={{flexDirection: 'row', marginBottom: 10, alignItems: 'center'}}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flex: 1}}>
                          <TouchableOpacity onPress={() => setSelectedAssignee(null)} style={[styles.assigneeTag, { backgroundColor: !selectedAssignee ? '#e6f7ff' : (isDarkMode ? '#333' : '#e8e8e8'), borderColor: !selectedAssignee ? '#00AEEF' : themeBorder }]}><Text style={[styles.assigneeTagText, { color: !selectedAssignee ? '#00AEEF' : themeSubText }]}>Ortak / Bana Ata</Text></TouchableOpacity>
                          {members.filter(m => m.user_id !== currentUserId && m.status === 'accepted').map(m => (
                            <TouchableOpacity key={m.user_id} onPress={() => setSelectedAssignee(m.user_id)} style={[styles.assigneeTag, { backgroundColor: selectedAssignee === m.user_id ? '#e6f7ff' : (isDarkMode ? '#333' : '#e8e8e8'), borderColor: selectedAssignee === m.user_id ? '#00AEEF' : themeBorder }]}><Text style={[styles.assigneeTagText, { color: selectedAssignee === m.user_id ? '#00AEEF' : themeSubText }]}>{m.profiles?.full_name?.split(' ')[0] || 'Üye'}</Text></TouchableOpacity>
                          ))}
                        </ScrollView>
                        <TouchableOpacity onPress={suggestAssigneeWithAI} disabled={aiAssignLoading} style={{backgroundColor: '#2b2b2b', padding: 8, borderRadius: 10, marginLeft: 5}}>
                           {aiAssignLoading ? <ActivityIndicator color="#FFD700" size="small"/> : <Text style={{color: '#FFD700', fontSize: 12, fontWeight: 'bold'}}>🧠 Kime Atayayım?</Text>}
                        </TouchableOpacity>
                    </View>
                    <View style={{flexDirection: 'row'}}>
                      <TextInput style={[styles.modalInput, {flex: 1, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} placeholder="Hızlı görev gir..." placeholderTextColor={themeSubText} value={newTaskTitle} onChangeText={setNewTaskTitle} />
                      <TouchableOpacity style={styles.addBtn} onPress={addOrgTask}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
                    </View>
                </View>
              )}

              <Text style={[styles.sectionTitle, { color: themeText }]}>{taskFilter === 'all' ? 'Tüm Takım Görevleri' : 'Benim Görevlerim'}</Text>
              {filteredTasks.length === 0 ? ( <Text style={{fontStyle: 'italic', color: themeSubText, marginBottom: 20}}>Gösterilecek görev bulunamadı.</Text>
              ) : (
                  filteredTasks.map(t => (
                      <TouchableOpacity key={t.id} style={[styles.miniTaskItem, { backgroundColor: themeCard, borderColor: themeBorder }]} onPress={() => openTaskDetails(t)}>
                          <View style={{width: 15, height: 15, borderRadius: 7.5, backgroundColor: getStatusColor(t.status), marginRight: 10}} />
                          <View style={{flex: 1}}>
                            <Text style={[styles.miniTaskText, { color: themeText }, t.status === 'Done' && {textDecorationLine: 'line-through', color: themeSubText}]}>{t.title}</Text>
                            <View style={{flexDirection: 'row', marginTop: 4, alignItems: 'center'}}>
                              <Ionicons name="person" size={12} color={themeSubText} />
                              <Text style={{fontSize: 12, color: themeSubText, marginLeft: 4, marginRight: 10}}>{t.assignee_profile?.full_name || 'Atanmadı'}</Text>
                              <Text style={{fontSize: 11, color: getStatusColor(t.status), fontWeight: 'bold'}}>{t.status}</Text>
                            </View>
                          </View>
                          <Ionicons name="chevron-forward" size={20} color={themeSubText} />
                      </TouchableOpacity>
                  ))
              )}
              <View style={{height: 40}}/>
            </ScrollView>
          )}

          {activeOrgTab === 'butce' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={[styles.dashboardCard, { backgroundColor: themeInputBg, borderColor: themeBorder }]}>
                <Text style={[styles.dashTitle, { color: themeText }]}>Bütçe Özeti (₺)</Text>
                <View style={{flexDirection: 'row', justifyContent: 'space-around'}}>
                  <View style={{alignItems: 'center'}}><Text style={{fontSize: 24, fontWeight: 'bold', color: 'green'}}>{totalExpense}</Text><Text style={{fontSize: 12, color: themeSubText}}>Gerçekleşen Harcama</Text></View>
                  <View style={{alignItems: 'center'}}><Text style={{fontSize: 24, fontWeight: 'bold', color: 'orange'}}>{pendingExpense}</Text><Text style={{fontSize: 12, color: themeSubText}}>Bekleyen Ödeme</Text></View>
                </View>
              </View>
              <Text style={[styles.sectionTitle, { color: themeText }]}>Yeni İhtiyaç / Harcama Ekle</Text>
              <View style={{flexDirection: 'row', gap: 5, marginBottom: 20}}>
                <TextInput style={[styles.modalInput, {flex: 2, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} placeholder="Malzeme adı..." placeholderTextColor={themeSubText} value={newResourceName} onChangeText={setNewResourceName} />
                <TextInput style={[styles.modalInput, {flex: 1, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} placeholder="Fiyat (₺)" placeholderTextColor={themeSubText} keyboardType="numeric" value={newResourceCost} onChangeText={setNewResourceCost} />
                <TouchableOpacity style={[styles.addBtn, {marginLeft: 5}]} onPress={addResource}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
              </View>
              <Text style={[styles.sectionTitle, { color: themeText }]}>Tüm Kaynaklar & Harcamalar</Text>
              {orgResources.map(res => (
                <View key={res.id} style={{flexDirection: 'row', alignItems: 'center', backgroundColor: themeCard, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: themeBorder, marginBottom: 8}}>
                  <TouchableOpacity onPress={() => cycleResourceStatus(res)} style={{marginRight: 10}}>
                    <Ionicons name={res.status === 'Alındı' ? "checkmark-circle" : (res.status === 'İptal' ? "close-circle" : "time")} size={28} color={res.status === 'Alındı' ? "green" : (res.status === 'İptal' ? "red" : "orange")} />
                  </TouchableOpacity>
                  <View style={{flex: 1}}>
                    <Text style={{fontWeight: 'bold', fontSize: 15, color: themeText}}>{res.name}</Text>
                    <Text style={{fontSize: 12, color: themeSubText}}>Ekleyen: {res.profiles?.full_name?.split(' ')[0]} | Durum: {res.status}</Text>
                  </View>
                  <Text style={{fontWeight: 'bold', color: '#800000', fontSize: 15, marginRight: 10}}>{res.cost} ₺</Text>
                  {selectedOrgRole === 'admin' && <TouchableOpacity onPress={() => deleteResource(res.id)}><Ionicons name="trash" size={20} color="red" /></TouchableOpacity>}
                </View>
              ))}
            </ScrollView>
          )}

          {activeOrgTab === 'tutanak' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { color: themeText }]}>Yeni Toplantı Tutanağı Ekleyin</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder }]} placeholder="Toplantı Konusu / Tarihi" placeholderTextColor={themeSubText} value={newMeetingTitle} onChangeText={setNewMeetingTitle} />
              <TextInput style={[styles.modalInput, {minHeight: 120, textAlignVertical: 'top', marginTop: 10, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} placeholder="Konuşulanları veya kararları buraya yapıştırın..." placeholderTextColor={themeSubText} multiline autoCapitalize="sentences" value={newMeetingContent} onChangeText={setNewMeetingContent} />
              <TouchableOpacity onPress={saveMeetingWithAI} disabled={aiMeetingLoading} style={{backgroundColor: '#800000', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10, flexDirection: 'row', justifyContent: 'center'}}>
                 {aiMeetingLoading ? <ActivityIndicator color="#FFD700" /> : <><Ionicons name="sparkles" size={20} color="#FFD700" /><Text style={{color: '#FFD700', fontWeight: 'bold', fontSize: 16, marginLeft: 8}}>AI ile Özetle ve Arşivle</Text></>}
              </TouchableOpacity>
              <Text style={[styles.sectionTitle, { color: themeText }]}>Geçmiş Tutanaklar</Text>
              {orgMeetings.length === 0 ? <Text style={{color: themeSubText, fontStyle: 'italic'}}>Henüz tutanak yok.</Text> : orgMeetings.map(m => (
                <View key={m.id} style={{backgroundColor: themeCard, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: themeBorder, marginBottom: 15}}>
                  <Text style={{fontWeight: 'bold', fontSize: 16, color: '#800000', marginBottom: 5}}>{m.title}</Text>
                  <Text style={{fontSize: 12, color: themeSubText, marginBottom: 10}}>Ekleyen: {m.profiles?.full_name} | Tarih: {new Date(m.created_at).toLocaleDateString('tr-TR')}</Text>
                  <View style={{backgroundColor: isDarkMode ? '#1A3A4A' : '#e6f7ff', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#00AEEF'}}>
                    <Text style={{fontWeight: 'bold', color: '#00AEEF', marginBottom: 5}}><Ionicons name="sparkles" /> AI Özeti & Kararlar:</Text>
                    <Text style={{color: themeText, fontSize: 13, lineHeight: 18}}>{m.summary}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}

          {activeOrgTab === 'sohbet' && (
            <View style={{flex: 1}}>
              <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10}}>
                  <Text style={[styles.sectionTitle, { color: themeText }]}>Takım Sohbeti</Text>
                  <TouchableOpacity onPress={triggerScrumMasterAI} disabled={aiScrumLoading} style={{backgroundColor: '#FFD700', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, flexDirection: 'row', alignItems: 'center'}}>
                      {aiScrumLoading ? <ActivityIndicator size="small" color="#000" /> : <><Ionicons name="sparkles" size={14} color="#000" /><Text style={{fontWeight: 'bold', fontSize: 12, marginLeft: 4, color: '#000'}}>AI Scrum Master ÇAĞIR</Text></>}
                  </TouchableOpacity>
              </View>
              <FlatList 
                data={messages} 
                keyExtractor={m => m.id} 
                showsVerticalScrollIndicator={false}
                renderItem={({item}) => {
                  const isAiBot = item.message.startsWith("[🤖 AI Asistan]");
                  const timeString = new Date(item.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

                  return (
                  <View style={[styles.msgBox, { backgroundColor: isAiBot ? (isDarkMode ? '#3A2E00' : '#fffbe6') : themeSecondaryBg }, item.user_id === currentUserId && !isAiBot && { backgroundColor: isDarkMode ? '#1A3A4A' : '#e6f7ff', alignSelf: 'flex-end', borderBottomRightRadius: 0 }, isAiBot && { borderWidth: 1, borderColor: '#FFD700', maxWidth: '95%' }]}>
                    <Text style={{fontSize: 11, fontWeight: 'bold', color: isAiBot ? '#B8860B' : (item.user_id === currentUserId ? '#00AEEF' : '#800000'), marginBottom: 3}}>
                      {isAiBot ? 'Scrum Master Bot' : (item.profiles?.full_name?.split(' ')[0] || 'Üye')}
                    </Text>
                    <Text style={{fontSize: 15, color: themeText}}>{item.message.replace('[🤖 AI Asistan]: ', '')}</Text>
                    <Text style={{fontSize: 10, color: themeSubText, alignSelf: 'flex-end', marginTop: 4}}>{timeString}</Text>
                  </View>
                  )
                }} 
              />
              <View style={{flexDirection: 'row', paddingTop: 10, borderTopWidth: 1, borderTopColor: themeBorder}}>
                <TextInput style={[styles.modalInput, {flex: 1, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} value={newMessage} onChangeText={setNewMessage} placeholder="Ekibe mesaj gönder..." placeholderTextColor={themeSubText} />
                <TouchableOpacity onPress={sendMessage} style={[styles.addBtn, {marginLeft: 10}]}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
              </View>
            </View>
          )}

          {activeOrgTab === 'anket' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { color: themeText }]}>Yeni Karar / Anket Oluştur</Text>
              <TextInput style={[styles.modalInput, { backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder }]} placeholder="Soru: Örn: Toplantı perşembe mi olsun cuma mı?" placeholderTextColor={themeSubText} value={newPollQuestion} onChangeText={setNewPollQuestion} />
              <View style={{flexDirection: 'row', gap: 10, marginTop: 10}}>
                <TextInput style={[styles.modalInput, {flex: 1, marginTop: 0, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} placeholder="Seçenek A" placeholderTextColor={themeSubText} value={newPollOption1} onChangeText={setNewPollOption1} />
                <TextInput style={[styles.modalInput, {flex: 1, marginTop: 0, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} placeholder="Seçenek B" placeholderTextColor={themeSubText} value={newPollOption2} onChangeText={setNewPollOption2} />
              </View>
              <TouchableOpacity onPress={createPoll} style={[styles.saveBtn, {marginTop: 10, alignSelf: 'flex-start'}]}>
                <Text style={styles.saveBtnText}>Anket Başlat</Text>
              </TouchableOpacity>
              <Text style={[styles.sectionTitle, { color: themeText }]}>Aktif Anketler & Ortak Kararlar</Text>
              {orgPolls.length === 0 ? <Text style={{color: themeSubText, fontStyle: 'italic'}}>Henüz anket yok.</Text> : orgPolls.map(poll => {
                const totalVotes = poll.org_poll_votes?.length || 0;
                return (
                  <View key={poll.id} style={[styles.dashboardCard, { backgroundColor: themeCard, borderColor: themeBorder }]}>
                    <Text style={[styles.dashTitle, {color: '#800000', marginBottom: 5}]}>{poll.question}</Text>
                    <Text style={{fontSize: 12, color: themeSubText, marginBottom: 15}}>Soran: {poll.profiles?.full_name} • {totalVotes} Oy</Text>
                    {poll.org_poll_options?.map(opt => {
                      const votesForOption = poll.org_poll_votes?.filter(v => v.option_id === opt.id).length || 0;
                      const percentage = totalVotes === 0 ? 0 : Math.round((votesForOption / totalVotes) * 100);
                      const hasVotedThis = poll.org_poll_votes?.some(v => v.option_id === opt.id && v.user_id === currentUserId);
                      return (
                        <TouchableOpacity key={opt.id} onPress={() => castVote(poll.id, opt.id)} style={{marginBottom: 10}}>
                          <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5}}>
                            <Text style={{fontWeight: hasVotedThis ? 'bold' : 'normal', color: themeText}}>{opt.option_text} {hasVotedThis && '✅'}</Text>
                            <Text style={{color: themeSubText, fontSize: 12}}>{percentage}% ({votesForOption})</Text>
                          </View>
                          <View style={{height: 8, backgroundColor: isDarkMode ? '#444' : '#eee', borderRadius: 4, overflow: 'hidden'}}>
                            <View style={{height: '100%', width: `${percentage}%`, backgroundColor: hasVotedThis ? '#00AEEF' : '#ccc'}} />
                          </View>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                );
              })}
            </ScrollView>
          )}

          {activeOrgTab === 'takvim' && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.sectionTitle, { color: themeText }]}>Proje Zaman Çizelgesi (Gantt)</Text>
              <Text style={{color: themeSubText, marginBottom: 15, fontSize: 13}}>Kilometre taşları ve görevlerin yatay akış şeması.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingBottom: 20}}>
                {orgTasks.filter(t => t.deadline).sort((a,b) => new Date(a.deadline) - new Date(b.deadline)).map((t) => (
                  <View key={t.id} style={{width: 220, backgroundColor: themeCard, padding: 18, borderRadius: 15, marginRight: 15, borderWidth: 1, borderColor: getStatusColor(t.status), borderLeftWidth: 6, elevation: 2}}>
                    <Text style={{fontSize: 12, color: themeSubText, fontWeight: 'bold'}}>{new Date(t.deadline).toLocaleDateString('tr-TR')}</Text>
                    <Text style={{fontSize: 16, fontWeight: 'bold', color: themeText, marginTop: 5, marginBottom: 10}} numberOfLines={2}>{t.title}</Text>
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <Ionicons name="person-circle" size={20} color={themeSubText} />
                      <Text style={{fontSize: 11, color: themeSubText, marginLeft: 5}} numberOfLines={1}>{t.assignee_profile?.full_name || 'Atanmadı'}</Text>
                    </View>
                    <View style={{marginTop: 12, paddingVertical: 4, paddingHorizontal: 10, backgroundColor: getStatusColor(t.status) + '20', borderRadius: 6, alignSelf: 'flex-start'}}>
                      <Text style={{fontSize: 11, color: getStatusColor(t.status), fontWeight: 'bold'}}>{t.status}</Text>
                    </View>
                  </View>
                ))}
                {orgTasks.length === 0 && <Text style={{color: themeSubText, fontStyle: 'italic', marginTop: 20}}>Zaman çizelgesinde gösterilecek görev yok.</Text>}
              </ScrollView>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* GÖREV DETAY MODALI */}
      <Modal transparent visible={taskDetailModalVisible} animationType="slide">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalBox, { backgroundColor: themeCard, maxHeight: '85%' }]}>
            <Text style={[styles.modalResponseTitle, { color: themeText }]}>{selectedOrgRole === 'admin' ? "Görevi Düzenle" : "Görev Detayı"}</Text>
            
            <View style={[styles.tabContainer, { backgroundColor: themeSecondaryBg }]}>
              <TouchableOpacity onPress={() => setActiveTab('detay')} style={[styles.tabBtn, activeTab === 'detay' && { backgroundColor: themeCard, elevation: 2 }]}><Text style={[styles.tabText, { color: activeTab === 'detay' ? '#800000' : themeSubText }]}>Detay</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('yorum')} style={[styles.tabBtn, activeTab === 'yorum' && { backgroundColor: themeCard, elevation: 2 }]}><Text style={[styles.tabText, { color: activeTab === 'yorum' ? '#800000' : themeSubText }]}>Yorumlar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setActiveTab('dosya')} style={[styles.tabBtn, activeTab === 'dosya' && { backgroundColor: themeCard, elevation: 2 }]}><Text style={[styles.tabText, { color: activeTab === 'dosya' ? '#800000' : themeSubText }]}>Dosyalar</Text></TouchableOpacity>
            </View>

            {activeTab === 'detay' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={{fontWeight: 'bold', color: themeSubText, marginTop: 10}}>Başlık</Text>
                {selectedOrgRole === 'admin' ? <TextInput style={[styles.modalInput, { backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder }]} value={activeTaskTitle} onChangeText={setActiveTaskTitle} /> : <Text style={[styles.modalInput, {backgroundColor: isDarkMode ? '#333' : '#eee', color: themeText}]}>{activeTaskTitle}</Text>}

                <Text style={{fontWeight: 'bold', color: themeSubText, marginTop: 10}}>Durum (Status)</Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5}}>
                  {statuses.map(s => {
                    const isOwner = currentUserId === activeTask?.assigned_to;
                    return (
                      <TouchableOpacity 
                        key={s} 
                        onPress={() => {
                          if (isOwner) { setActiveTaskStatus(s); } else { Alert.alert("Erişim Engellendi 🛑", "Yönetici dahi olsanız, sadece bu göreve atanan kişi durumunu güncelleyebilir."); }
                        }} 
                        style={[
                          styles.assigneeTag, { backgroundColor: isDarkMode ? '#333' : '#e8e8e8', borderColor: themeBorder },
                          activeTaskStatus === s && {backgroundColor: getStatusColor(s), borderColor: getStatusColor(s)},
                          !isOwner && { opacity: 0.5 }
                        ]}
                      >
                        <Text style={[styles.assigneeTagText, { color: themeText }, activeTaskStatus === s && {color: '#fff', fontWeight: 'bold'}]}>{s}</Text>
                      </TouchableOpacity>
                    )
                  })}
                </View>

                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15}}>
                    <Text style={{fontWeight: 'bold', color: themeSubText}}>Alt Görevler (Checklist)</Text>
                    {selectedOrgRole === 'admin' && (
                        <TouchableOpacity onPress={generateSubtasksWithAI} disabled={aiSubtaskLoading} style={{backgroundColor: '#2b2b2b', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10}}>
                           {aiSubtaskLoading ? <ActivityIndicator size="small" color="#FFD700" /> : <Text style={{color: '#FFD700', fontSize: 12, fontWeight: 'bold'}}>✨ AI ile Parçala</Text>}
                        </TouchableOpacity>
                    )}
                </View>
                
                {selectedOrgRole === 'admin' && (
                    <View style={{flexDirection: 'row', marginBottom: 10, marginTop: 5}}>
                      <TextInput style={[styles.modalInput, {flex: 1, marginBottom: 0, height: 45, marginTop: 0, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} value={newSubtask} onChangeText={setNewSubtask} placeholder="Manuel alt görev ekle..." placeholderTextColor={themeSubText} />
                      <TouchableOpacity onPress={addSubtask} style={{backgroundColor: '#800000', paddingHorizontal: 15, justifyContent: 'center', borderRadius: 10, marginLeft: 10}}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
                    </View>
                )}

                {activeTaskSubtasks.map(st => {
                  const isOwner = currentUserId === activeTask?.assigned_to;
                  return (
                  <View key={st.id} style={[styles.subtaskRow, { backgroundColor: themeInputBg, borderColor: themeBorder }]}>
                    <TouchableOpacity onPress={() => {
                        if (isOwner) { toggleSubtask(st.id); } else { Alert.alert("Erişim Engellendi 🛑", "Alt görevleri sadece işin sorumlusu işaretleyebilir."); }
                    }}>
                      <Ionicons name={st.completed ? "checkbox" : "square-outline"} size={24} color={st.completed ? "green" : (isOwner ? themeSubText : (isDarkMode ? "#444" : "#ddd"))} />
                    </TouchableOpacity>
                    <Text style={[styles.subtaskText, { color: themeText }, st.completed && {textDecorationLine: 'line-through', color: themeSubText}]}>{st.text}</Text>
                    {selectedOrgRole === 'admin' && <TouchableOpacity onPress={() => deleteSubtask(st.id)}><Ionicons name="close" size={20} color="red" /></TouchableOpacity>}
                  </View>
                )})}

                <Text style={{fontWeight: 'bold', color: themeSubText, marginTop: 15}}>Açıklama & Notlar</Text>
                {selectedOrgRole === 'admin' ? <TextInput style={[styles.modalInput, {minHeight: 100, textAlignVertical: 'top', backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} value={activeTaskNotes} onChangeText={setActiveTaskNotes} multiline autoCapitalize="sentences" placeholder="Görev açıklaması ekle..." placeholderTextColor={themeSubText} /> : <ScrollView style={[styles.modalInput, {height: 100, backgroundColor: isDarkMode ? '#333' : '#eee', borderColor: themeBorder}]}><Text style={{ color: themeText }}>{activeTaskNotes || 'Açıklama girilmemiş.'}</Text></ScrollView>}
              </ScrollView>
            )}

            {activeTab === 'yorum' && (
              <View style={{flex: 1, minHeight: 200}}>
                <FlatList data={taskComments} keyExtractor={c => c.id} renderItem={({item}) => (
                    <View style={{padding: 10, backgroundColor: themeInputBg, borderRadius: 8, marginBottom: 8}}>
                      <Text style={{fontSize: 11, color: '#00AEEF', fontWeight: 'bold'}}>{item.profiles?.full_name}</Text>
                      <Text style={{color: themeText, marginTop: 2}}>{item.comment}</Text>
                    </View>
                  )} ListEmptyComponent={<Text style={{color: themeSubText, fontStyle: 'italic', textAlign: 'center'}}>Henüz yorum yok.</Text>} />
                <View style={{flexDirection: 'row', marginTop: 10}}>
                  <TextInput style={[styles.modalInput, {flex: 1, height: 45, padding: 10, marginTop: 0, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} placeholder="Yorum yaz..." placeholderTextColor={themeSubText} value={newComment} onChangeText={setNewComment} />
                  <TouchableOpacity style={styles.addBtn} onPress={addTaskComment}><Ionicons name="send" size={20} color="#fff" /></TouchableOpacity>
                </View>
              </View>
            )}

            {activeTab === 'dosya' && (
              <View style={{flex: 1, minHeight: 200}}>
                <View style={{flexDirection: 'row', gap: 5, marginBottom: 10}}>
                   <TextInput style={[styles.modalInput, {flex: 1, marginTop: 0, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} placeholder="Sürüm (Örn: v1.0)" placeholderTextColor={themeSubText} value={fileVersion} onChangeText={setFileVersion} />
                   <TouchableOpacity onPress={handleFileUpload} disabled={uploading} style={{backgroundColor: isDarkMode ? '#1A3A4A' : '#e6f7ff', padding: 15, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: '#00AEEF', borderStyle: 'dashed', flex: 2}}>
                     {uploading ? <ActivityIndicator color="#00AEEF" /> : <Text style={{color: '#00AEEF', fontWeight: 'bold'}}><Ionicons name="cloud-upload" size={18} /> Dosya Yükle</Text>}
                   </TouchableOpacity>
                </View>
                <FlatList data={taskFiles} keyExtractor={f => f.id} renderItem={({item}) => (
                    <View style={{flexDirection: 'row', alignItems: 'center', padding: 10, backgroundColor: themeCard, borderRadius: 8, marginBottom: 5, borderWidth: 1, borderColor: themeBorder}}>
                      <Ionicons name="document-text" size={24} color="#800000" />
                      <View style={{marginLeft: 10, flex: 1}}>
                        <Text style={{color: themeText, fontWeight: 'bold'}} numberOfLines={1}>{item.file_name}</Text>
                        <Text style={{color: '#800000', fontSize: 11, fontWeight: 'bold'}}>Sürüm: {item.version || 'v1.0'}</Text>
                      </View>
                    </View>
                  )} ListEmptyComponent={<Text style={{color: themeSubText, fontStyle: 'italic', textAlign: 'center'}}>Eklenmiş dosya yok.</Text>} />
              </View>
            )}

            <View style={[styles.modalActionRow, {marginTop: 20}]}>
              {selectedOrgRole === 'admin' && activeTab === 'detay' && <TouchableOpacity onPress={deleteOrgTask} style={styles.cancelBtn}><Text style={[styles.cancelBtnText, {color: 'red'}]}>Sil</Text></TouchableOpacity>}
              <TouchableOpacity onPress={() => setTaskDetailModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Kapat</Text></TouchableOpacity>
              
              {(selectedOrgRole === 'admin' || currentUserId === activeTask?.assigned_to) && (
                  <TouchableOpacity onPress={updateTaskDetails} style={[styles.saveBtn]}><Text style={styles.saveBtnText}>Kaydet</Text></TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={responseModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlayCenter}>
          <View style={[styles.editModalBox, { backgroundColor: themeCard }]}>
            <Text style={[styles.modalResponseTitle, { color: themeText }]}>{responseType === 'accept' ? 'Daveti Kabul Et' : 'Daveti Reddet'}</Text>
            <TextInput style={[styles.modalInput, {height: 100, textAlignVertical: 'top', marginBottom: 20, marginTop: 10, backgroundColor: themeInputBg, color: themeText, borderColor: themeBorder}]} value={responseMessage} onChangeText={setResponseMessage} placeholder={responseType === 'accept' ? "Teşekkürler!" : "Katılamıyorum..."} placeholderTextColor={themeSubText} multiline />
            <View style={styles.modalActionRow}>
              <TouchableOpacity onPress={() => setResponseModalVisible(false)} style={styles.cancelBtn}><Text style={styles.cancelBtnText}>Vazgeç</Text></TouchableOpacity>
              <TouchableOpacity onPress={submitInviteResponse} style={[styles.saveBtn, {backgroundColor: responseType === 'accept' ? 'green' : '#800000'}]}><Text style={styles.saveBtnText}>İlet</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, paddingTop: 60, backgroundColor: '#f9f9f9' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  backBtn: { marginRight: 15 },
  title: { fontSize: 28, fontWeight: 'bold', color: '#800000' },
  sub: { fontWeight: 'bold', marginBottom: 12, fontSize: 16, marginTop: 10 },
  globalDashCard: { backgroundColor: '#800000', padding: 20, borderRadius: 15, marginBottom: 20, elevation: 4 },
  globalDashTitle: { color: '#FFD700', fontSize: 18, fontWeight: 'bold', textAlign: 'center' },
  globalDashNum: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  globalDashLabel: { fontSize: 13, color: '#eee', marginTop: 4 },
  inviteBox: { padding: 18, borderRadius: 15, marginBottom: 20, elevation: 2 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', marginVertical: 8, paddingBottom: 12, borderBottomWidth: 1 },
  inviteOrgName: { fontWeight: 'bold', fontSize: 17 },
  inviteMsgText: { fontStyle: 'italic', marginTop: 6, fontSize: 14 },
  createRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  input: { flex: 1, padding: 15, borderRadius: 12, borderWidth: 1, fontSize: 16 },
  orgItem: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 15, marginBottom: 12, elevation: 2 },
  orgIconBg: { backgroundColor: '#00AEEF', padding: 10, borderRadius: 10 },
  orgText: { flex: 1, marginLeft: 15, fontWeight: '600', fontSize: 17 },
  modalContent: { flex: 1, padding: 25, marginTop: 40, borderTopLeftRadius: 25, borderTopRightRadius: 25, elevation: 10 },
  leaveBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#ffe6e6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  modalTitle: { fontSize: 26, fontWeight: 'bold', color: '#800000' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginTop: 25, marginBottom: 10 },
  modalInput: { padding: 15, borderRadius: 12, borderWidth: 1, fontSize: 16 },
  addBtn: { backgroundColor: '#800000', paddingHorizontal: 20, justifyContent: 'center', borderRadius: 12, marginLeft: 10 },
  tabContainer: { flexDirection: 'row', borderRadius: 12, padding: 4, marginBottom: 20 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabText: { fontSize: 14, fontWeight: '600' },
  mainTabBtn: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, marginRight: 10, flexDirection: 'row', alignItems: 'center', gap: 5 },
  mainTabText: { fontSize: 14, fontWeight: 'bold' },
  assigneeTag: { paddingVertical: 6, paddingHorizontal: 15, borderRadius: 10, marginRight: 8, borderWidth: 1 },
  assigneeTagText: { fontSize: 13, fontWeight: '500' },
  dashboardCard: { padding: 20, borderRadius: 15, borderWidth: 1 },
  dashTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 15 },
  miniTaskItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 8, elevation: 1, borderWidth: 1 },
  miniTaskText: { fontSize: 15, fontWeight: '600' },
  msgBox: { padding: 12, borderRadius: 15, marginVertical: 5, maxWidth: '85%', alignSelf: 'flex-start' },
  modalOverlayCenter: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  editModalBox: { width: '90%', padding: 25, borderRadius: 20, elevation: 10 },
  modalResponseTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  modalActionRow: { flexDirection: 'row', justifyContent: 'center', gap: 15, alignItems: 'center' },
  cancelBtn: { padding: 12 },
  cancelBtnText: { color: '#888', fontWeight: 'bold', fontSize: 16 },
  saveBtn: { backgroundColor: '#800000', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 8, marginBottom: 5, borderWidth: 1 },
  subtaskText: { flex: 1, marginLeft: 10, fontSize: 15 },
  memberCard: { flexDirection: 'row', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1 },
  toastContainer: { position: 'absolute', top: 55, left: 20, right: 20, backgroundColor: '#2b2b2b', padding: 15, borderRadius: 15, flexDirection: 'row', alignItems: 'center', zIndex: 9999, elevation: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  toastTitle: { color: '#FFD700', fontWeight: 'bold', fontSize: 16 },
  toastMsg: { color: '#fff', fontSize: 14, marginTop: 2 }
});