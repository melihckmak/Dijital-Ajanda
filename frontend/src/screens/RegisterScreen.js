import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert } from 'react-native';
import { supabase } from '../services/supabaseClient';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!email || !password || !name) {
      Alert.alert("Hata", "Tüm alanları doldur knk.");
      return;
    }

    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: email.trim(),
      password: password,
    });

    if (authError) { Alert.alert("Hata", authError.message); return; }

    if (authData.user) {
      await supabase.from('profiles').insert([{ id: authData.user.id, full_name: `${name} ${surname}` }]);
      Alert.alert("Başarılı", "Hesabın açıldı! Şimdi giriş yapabilirsin.");
      navigation.navigate('Login'); // Kayıt sonrası giriş ekranına zorlar
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Yeni Kayıt</Text>
      <TextInput style={styles.input} placeholder="İsim" value={name} onChangeText={setName} />
      <TextInput style={styles.input} placeholder="Soyisim" value={surname} onChangeText={setSurname} />
      <TextInput style={styles.input} placeholder="E-posta" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Şifre" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={handleRegister}><Text style={styles.btnText}>Kayıt Ol</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.link}>Giriş Yap</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 30, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#800000', textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: '#f9f9f9', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#eee' },
  btn: { backgroundColor: '#00AEEF', padding: 18, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: 'bold' },
  link: { color: '#800000', textAlign: 'center', marginTop: 20 }
});