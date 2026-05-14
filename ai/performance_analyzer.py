import pandas as pd

def calculate_user_performance(user_tasks):
    """
    Kullanıcının bitirdiği ve geciktirdiği görevlere göre bir Verimlilik Skoru hesaplar
    ve kullanıcıya özel motivasyon mesajı üretir. 
    
    Beklenen veri formatı (List of Dictionaries):
    [{'gorev_adi': 'Matematik', 'durum': 'tamamlandi', 'zamaninda_mi': True}, ...]
    """
    if not user_tasks:
        return {"skor": 0, "mesaj": "Henüz hiç görev eklenmemiş. Planlama yapmaya başla!"}

    df = pd.DataFrame(user_tasks)
    
    toplam_gorev = len(df)
    tamamlanan = len(df[df['durum'] == 'tamamlandi'])
    zamaninda_biten = len(df[(df['durum'] == 'tamamlandi') & (df['zamaninda_mi'] == True)])
    
    # Basit Algoritma: Tamamlama oranı %60 etkili, Zamanında bitirme %40 etkili
    tamamlama_puani = (tamamlanan / toplam_gorev) * 60
    zaman_puani = (zamaninda_biten / max(1, tamamlanan)) * 40
    
    genel_skor = round(tamamlama_puani + zaman_puani, 2)
    
    # Skora göre AI destekli (kural tabanlı) geri bildirim
    if genel_skor >= 85:
        mesaj = "Harika bir hafta! Zaman yönetimi konusunda bir uzmansın."
    elif genel_skor >= 50:
        mesaj = "İyi gidiyorsun ama planlarına biraz daha sadık kalabilirsin."
    else:
        mesaj = "Görevler birikiyor gibi görünüyor. Belki de görevleri daha küçük parçalara bölmelisin."
        
    return {
        "verimlilik_skoru": genel_skor,
        "analiz_mesaji": mesaj,
        "tamamlanan_gorev": tamamlanan,
        "toplam_gorev": toplam_gorev
    }

# Test Kodu
if __name__ == "__main__":
    ornek_veriler = [
        {'gorev_adi': 'COM2010 Rapor', 'durum': 'tamamlandi', 'zamaninda_mi': True},
        {'gorev_adi': 'Veritabanı Şeması', 'durum': 'tamamlandi', 'zamaninda_mi': False},
        {'gorev_adi': 'Arayüz Tasarımı', 'durum': 'bekliyor', 'zamaninda_mi': False}
    ]
    sonuc = calculate_user_performance(ornek_veriler)
    print(f"Performans Skoru: {sonuc['verimlilik_skoru']}/100")
    print(f"AI Yorumu: {sonuc['analiz_mesaji']}")