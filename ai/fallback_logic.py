def calculate_fallback_priority(kategori, kalan_gun, zorluk_derecesi):
    """
    Risk Yönetimi (B Planı): Yapay zeka modeli yanıt vermezse devreye girecek klasik sıralama algoritması.
    """
    print("UYARI: Yapay zeka yanıt vermedi, klasik Fallback algoritması devrede!")
    
    # Kategorilere göre önem katsayıları
    kategori_agirlik = {
        "Sinav": 1.5, 
        "Proje": 1.3, 
        "Odev": 1.1, 
        "Gorev": 0.8
    }
    agirlik = kategori_agirlik.get(kategori, 1.0)
    
    # Teslim tarihine ne kadar az kalırsa puan o kadar artar (Ters orantı)
    # Maksimum 30 gün varsayılarak hesaplanır
    gun_puani = max(0, (30 - kalan_gun) * 2.5) 
    
    # Zorluk derecesi (1-5) puanı doğrudan etkiler
    zorluk_puani = zorluk_derecesi * 8
    
    # Formül: (Gün Puanı + Zorluk Puanı) * Kategori Ağırlığı
    skor = (gun_puani + zorluk_puani) * agirlik
    
    # Skor 100'ü geçemez
    return min(100.0, round(skor, 2))

# Test kodu (Sadece bu dosya çalıştırıldığında çalışır)
if __name__ == "__main__":
    test_skor = calculate_fallback_priority("Proje", 3, 4)
    print(f"Fallback Test Skoru: {test_skor} / 100")