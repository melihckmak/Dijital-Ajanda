import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../services/supabaseClient'; // Veritabanı motorumuz

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Hata", "Lütfen e-posta ve şifrenizi girin.");
      return;
    }

    setLoading(true);
    
    // Supabase Auth ile giriş yapma işlemi
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      Alert.alert("Giriş Başarısız", error.message);
      setLoading(false);
    } else {
      setLoading(false);
      // Giriş başarılı olunca doğrudan Home (Ajanda) ekranına geç
      navigation.replace('Home');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dijital Ajanda</Text>
      <Text style={styles.subtitle}>Giriş yaparak görevlerini yönetmeye başla</Text>

      <TextInput 
        style={styles.input} 
        placeholder="E-posta" 
        value={email} 
        onChangeText={setEmail} 
        keyboardType="email-address" 
        autoCapitalize="none" 
      />
      
      <TextInput 
        style={styles.input} 
        placeholder="Şifre" 
        value={password} 
        onChangeText={setPassword} 
        secureTextEntry 
      />

      <TouchableOpacity 
        style={styles.loginBtn} 
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.loginBtnText}>Giriş Yap</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Register')}>
        <Text style={styles.linkText}>Henüz hesabın yok mu? Kayıt Ol</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#F5F5F5' },
  title: { fontSize: 36, fontWeight: 'bold', color: '#800000', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: '#fff', padding: 15, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#ddd', fontSize: 16 },
  loginBtn: { backgroundColor: '#00AEEF', padding: 15, borderRadius: 8, alignItems: 'center', marginBottom: 15, height: 55, justifyContent: 'center' },
  loginBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  linkText: { color: '#800000', textAlign: 'center', fontSize: 16, fontWeight: '500' }
});