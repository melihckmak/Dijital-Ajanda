import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, Alert, Modal, ScrollView } from 'react-native';
import { supabase } from '../services/supabaseClient';
import { Ionicons } from '@expo/vector-icons';

export default function OrganizationScreen({ navigation }) {
  const [myOrgs, setMyOrgs] = useState([]);
  const [invites, setInvites] = useState([]);
  const [newOrgName, setNewOrgName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    // Onaylı gruplarımı getir
    const { data: orgs } = await supabase.from('organization_members')
      .select('organizations(*)').eq('user_id', user.id).eq('status', 'accepted');
    setMyOrgs(orgs?.map(o => o.organizations) || []);

    // Bekleyen davetleri getir
    const { data: invs } = await supabase.from('organization_members')
      .select('id, organizations(name, id)').eq('user_id', user.id).eq('status', 'pending');
    setInvites(invs || []);
  };

  const handleInvite = async (orgId, type) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (type === 'accept') {
      await supabase.from('organization_members').update({ status: 'accepted' }).eq('org_id', orgId).eq('user_id', user.id);
    } else {
      await supabase.from('organization_members').delete().eq('org_id', orgId).eq('user_id', user.id);
    }
    fetchAll();
  };

  const createOrg = async () => {
    if (!newOrgName.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from('organizations').insert([{ name: newOrgName, created_by: user.id }]).select().single();
    if (data) {
      await supabase.from('organization_members').insert([{ org_id: data.id, user_id: user.id, status: 'accepted', role: 'admin' }]);
      setNewOrgName(''); fetchAll();
    }
  };

  const sendInvite = async () => {
    const { error } = await supabase.rpc('add_user_to_org_by_email', {
      target_email: inviteEmail.trim().toLowerCase(),
      target_org_id: selectedOrg.id
    });
    if (error) Alert.alert("Hata", "Kullanıcı bulunamadı.");
    else { Alert.alert("Başarılı", "Davet gönderildi!"); setInviteEmail(''); }
  };

  const openOrgDetails = async (org) => {
    setSelectedOrg(org);
    const { data } = await supabase.from('organization_members')
      .select('profiles(full_name), status').eq('org_id', org.id).eq('status', 'accepted');
    setMembers(data || []);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()}><Ionicons name="arrow-back" size={28} color="#800000" /></TouchableOpacity>
      <Text style={styles.title}>Organizasyonlarım</Text>

      {invites.length > 0 && (
        <View style={styles.inviteBox}>
          <Text style={styles.sub}>Bekleyen Davetler ({invites.length})</Text>
          {invites.map(i => (
            <View key={i.id} style={styles.inviteCard}>
              <Text style={{flex:1}}>{i.organizations.name}</Text>
              <TouchableOpacity onPress={() => handleInvite(i.organizations.id, 'accept')}><Ionicons name="checkmark-circle" size={32} color="green" /></TouchableOpacity>
              <TouchableOpacity onPress={() => handleInvite(i.organizations.id, 'reject')}><Ionicons name="close-circle" size={32} color="red" /></TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.createRow}>
        <TextInput style={styles.input} placeholder="Yeni Grup..." value={newOrgName} onChangeText={setNewOrgName} />
        <TouchableOpacity onPress={createOrg}><Ionicons name="add-circle" size={45} color="#800000" /></TouchableOpacity>
      </View>

      <FlatList 
        data={myOrgs} 
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.orgItem} onPress={() => openOrgDetails(item)}>
            <Ionicons name="people" size={24} color="#00AEEF" />
            <Text style={styles.orgText}>{item.name}</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        )} 
      />

      <Modal visible={modalVisible} animationType="slide">
        <View style={styles.modalContent}>
          <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={32} /></TouchableOpacity>
          <Text style={styles.modalTitle}>{selectedOrg?.name} Üyeleri</Text>
          <View style={{flexDirection: 'row', gap: 10, marginBottom: 20}}>
            <TextInput style={[styles.input, {flex:1}]} placeholder="Mail ile davet et..." value={inviteEmail} onChangeText={setInviteEmail} />
            <TouchableOpacity onPress={sendInvite} style={styles.sendBtn}><Text style={{color:'#fff'}}>Ekle</Text></TouchableOpacity>
          </View>
          <ScrollView>
            {members.map((m, idx) => (
              <View key={idx} style={styles.memberRow}>
                <Ionicons name="person-outline" size={18} />
                <Text style={{marginLeft: 10}}>{m.profiles?.full_name}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 25, paddingTop: 60, backgroundColor: '#f9f9f9' },
  title: { fontSize: 24, fontWeight: 'bold', color: '#800000', marginBottom: 20 },
  sub: { fontWeight: 'bold', marginBottom: 10, color: '#666' },
  inviteBox: { backgroundColor: '#fff', padding: 15, borderRadius: 15, marginBottom: 20, elevation: 2 },
  inviteCard: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  createRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  input: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee' },
  orgItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 15, marginBottom: 10, elevation: 2 },
  orgText: { flex: 1, marginLeft: 15, fontWeight: '600' },
  modalContent: { flex: 1, padding: 30, marginTop: 50 },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginVertical: 15 },
  sendBtn: { backgroundColor: '#800000', padding: 12, borderRadius: 10 },
  memberRow: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' }
});