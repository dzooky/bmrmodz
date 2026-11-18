'use strict';

// English key | Hungarian | Polish | Slovak | Czech | Italian | Russian.
const text = `
My Car|Autóm|Mój samochód|Moje auto|Moje auto|La mia auto|Мой автомобиль
About|Az alkalmazásról|O aplikacji|O aplikácii|O aplikaci|Informazioni|О приложении
Settings|Beállítások|Ustawienia|Nastavenia|Nastavení|Impostazioni|Настройки
Language|Nyelv|Język|Jazyk|Jazyk|Lingua|Язык
Add Fuel|Tankolás rögzítése|Dodaj tankowanie|Pridať tankovanie|Přidat tankování|Aggiungi rifornimento|Добавить заправку
Add AdBlue|AdBlue-utántöltés|Dodaj AdBlue|Pridať AdBlue|Přidat AdBlue|Aggiungi AdBlue|Добавить AdBlue
Colour theme|Színtéma|Motyw kolorystyczny|Farebná téma|Barevný motiv|Tema colori|Цветовая тема
Screen layout|Képernyőelrendezés|Układ ekranu|Rozloženie obrazovky|Rozložení obrazovky|Layout dello schermo|Компоновка экрана
Full screen|Teljes képernyő|Pełny ekran|Celá obrazovka|Celá obrazovka|Schermo intero|Полный экран
Renderer|Grafikus mód|Tryb renderowania|Režim vykresľovania|Režim vykreslování|Modalità grafica|Режим отрисовки
Software|Szoftveres|Programowy|Softvérový|Softwarový|Software|Программный
Ice White|Jégfehér|Lodowa biel|Ľadová biela|Ledová bílá|Bianco ghiaccio|Ледяной белый
Night Amber|Éjszakai borostyán|Nocny bursztyn|Nočná jantárová|Noční jantarová|Ambra notturna|Ночной янтарь
Full tank threshold (fuel)|Teletankolási küszöb|Próg pełnego baku|Hranica plnej nádrže|Hranice plné nádrže|Soglia serbatoio pieno|Порог полного бака
Fuel tank capacity|Üzemanyagtartály térfogata|Pojemność baku|Objem palivovej nádrže|Objem palivové nádrže|Capacità del serbatoio|Объём бака
Reset trip, avg. speed and consumption after fuel upload (experimental)|Út, átlagsebesség és fogyasztás nullázása feltöltés után (kísérleti)|Zeruj przebieg dzienny, średnią prędkość i spalanie po wysłaniu (eksperymentalne)|Vynulovať trasu, priemernú rýchlosť a spotrebu po odoslaní (experimentálne)|Vynulovat trasu, průměrnou rychlost a spotřebu po odeslání (experimentální)|Azzera percorso, velocità media e consumo dopo l’invio (sperimentale)|Сбрасывать пробег, среднюю скорость и расход после отправки (экспериментально)
On|Be|Włączone|Zapnuté|Zapnuto|Attivo|Вкл.
Off|Ki|Wyłączone|Vypnuté|Vypnuto|Disattivo|Выкл.
Back|Vissza|Wstecz|Späť|Zpět|Indietro|Назад
Next|Tovább|Dalej|Ďalej|Dále|Avanti|Далее
Previous|Előző|Poprzednia|Predchádzajúca|Předchozí|Precedente|Назад
Done|Kész|Gotowe|Hotovo|Hotovo|Fine|Готово
Cancel|Mégse|Anuluj|Zrušiť|Zrušit|Annulla|Отмена
Save|Mentés|Zapisz|Uložiť|Uložit|Salva|Сохранить
Clear|Ürítés|Wyczyść|Vymazať|Vymazat|Svuota|Очистить
Delete|Törlés|Usuń|Zmazať|Smazat|Elimina|Удалить
Space|Szóköz|Spacja|Medzera|Mezera|Spazio|Пробел
selected|kiválasztva|wybrano|vybrané|vybráno|selezionato|выбрано
1 / 2   Create and copy your token|1 / 2   Token létrehozása és másolása|1 / 2   Utwórz i skopiuj token|1 / 2   Vytvor a skopíruj token|1 / 2   Vytvoř a zkopíruj token|1 / 2   Crea e copia il token|1 / 2   Создайте и скопируйте токен
2 / 2   Paste your token|2 / 2   Token beillesztése|2 / 2   Wklej token|2 / 2   Vlož token|2 / 2   Vlož token|2 / 2   Incolla il token|2 / 2   Вставьте токен
Scan to sign in to Spritmonitor. Create a token and copy it.|Olvasd be a kódot, lépj be a Spritmonitorba, majd hozz létre és másolj egy tokent.|Zeskanuj kod, zaloguj się do Spritmonitor, utwórz token i skopiuj go.|Naskenuj kód, prihlás sa do Spritmonitoru, vytvor token a skopíruj ho.|Naskenuj kód, přihlas se do Spritmonitoru, vytvoř token a zkopíruj ho.|Scansiona il codice, accedi a Spritmonitor, crea un token e copialo.|Отсканируйте код, войдите в Spritmonitor, создайте и скопируйте токен.
Scan to open the pairing page. Paste your token and send it to iDrive.|Olvasd be a kódot, illeszd be a tokent a párosítási oldalon, és küldd el az iDrive-nak.|Zeskanuj kod, wklej token na stronie parowania i wyślij go do iDrive.|Naskenuj kód, vlož token na párovacej stránke a odošli ho do iDrive.|Naskenuj kód, vlož token na párovací stránce a odešli jej do iDrive.|Scansiona il codice, incolla il token nella pagina di associazione e invialo a iDrive.|Отсканируйте код, вставьте токен на странице подключения и отправьте в iDrive.
Remove vehicle|Jármű eltávolítása|Usuń pojazd|Odstrániť vozidlo|Odebrat vozidlo|Rimuovi veicolo|Удалить автомобиль
Choose vehicle|Jármű kiválasztása|Wybierz pojazd|Vybrať vozidlo|Vybrat vozidlo|Scegli veicolo|Выбрать автомобиль
Select your vehicle|Válaszd ki a járművedet|Wybierz swój pojazd|Vyber svoje vozidlo|Vyber své vozidlo|Seleziona il tuo veicolo|Выберите автомобиль
Disconnect account|Fiók leválasztása|Odłącz konto|Odpojiť účet|Odpojit účet|Scollega account|Отключить аккаунт
No vehicle connected|Nincs csatlakoztatott jármű|Nie połączono pojazdu|Žiadne vozidlo nie je pripojené|Není připojeno žádné vozidlo|Nessun veicolo collegato|Автомобиль не подключён
No vehicles found in this account.|Ebben a fiókban nincs jármű.|Brak pojazdów na tym koncie.|V tomto účte sa nenašli žiadne vozidlá.|V tomto účtu nebyla nalezena žádná vozidla.|Nessun veicolo trovato in questo account.|В этом аккаунте нет автомобилей.
Loading vehicles from Spritmonitor...|Járművek betöltése a Spritmonitorból…|Wczytywanie pojazdów ze Spritmonitor…|Načítavam vozidlá zo Spritmonitoru…|Načítám vozidla ze Spritmonitoru…|Caricamento dei veicoli da Spritmonitor…|Загрузка автомобилей из Spritmonitor…
Loading selected vehicle...|A kiválasztott jármű betöltése…|Wczytywanie wybranego pojazdu…|Načítavam vybrané vozidlo…|Načítám vybrané vozidlo…|Caricamento del veicolo selezionato…|Загрузка выбранного автомобиля…
Could not start phone pairing.|A telefon párosítása nem indítható.|Nie udało się rozpocząć parowania telefonu.|Nepodarilo sa spustiť párovanie telefónu.|Nepodařilo se spustit párování telefonu.|Impossibile avviare l’associazione del telefono.|Не удалось начать подключение телефона.
Could not disconnect the Spritmonitor account.|A Spritmonitor-fiók nem választható le.|Nie udało się odłączyć konta Spritmonitor.|Nepodarilo sa odpojiť účet Spritmonitor.|Nepodařilo se odpojit účet Spritmonitor.|Impossibile scollegare l’account Spritmonitor.|Не удалось отключить аккаунт Spritmonitor.
Could not remove the vehicle from iDrive.|A jármű nem távolítható el az iDrive-ból.|Nie udało się usunąć pojazdu z iDrive.|Nepodarilo sa odstrániť vozidlo z iDrive.|Nepodařilo se odebrat vozidlo z iDrive.|Impossibile rimuovere il veicolo da iDrive.|Не удалось удалить автомобиль из iDrive.
Could not read the Spritmonitor account setup.|A Spritmonitor-fiók beállítása nem olvasható.|Nie udało się odczytać ustawień konta Spritmonitor.|Nepodarilo sa načítať nastavenie účtu Spritmonitor.|Nepodařilo se načíst nastavení účtu Spritmonitor.|Impossibile leggere la configurazione dell’account Spritmonitor.|Не удалось прочитать настройки аккаунта Spritmonitor.
Could not open local fuelling storage.|A helyi tankolási adatok nem nyithatók meg.|Nie udało się otworzyć lokalnych danych tankowania.|Nepodarilo sa otvoriť lokálne úložisko tankovaní.|Nepodařilo se otevřít místní úložiště tankování.|Impossibile aprire l’archivio locale dei rifornimenti.|Не удалось открыть локальное хранилище заправок.
Could not cache vehicle data.|A járműadatok nem menthetők helyben.|Nie udało się zapisać danych pojazdu lokalnie.|Nepodarilo sa uložiť údaje vozidla do pamäte.|Nepodařilo se uložit údaje vozidla do mezipaměti.|Impossibile salvare i dati del veicolo nella cache.|Не удалось сохранить данные автомобиля в кэше.
Selected vehicle unavailable|A kiválasztott jármű nem érhető el|Wybrany pojazd jest niedostępny|Vybrané vozidlo je nedostupné|Vybrané vozidlo je nedostupné|Veicolo selezionato non disponibile|Выбранный автомобиль недоступен
Spritmonitor sign-in required|Bejelentkezés szükséges a Spritmonitorba|Wymagane logowanie do Spritmonitor|Vyžaduje sa prihlásenie do Spritmonitoru|Je nutné přihlášení do Spritmonitoru|Accesso a Spritmonitor richiesto|Требуется вход в Spritmonitor
Spritmonitor busy|A Spritmonitor túlterhelt|Spritmonitor jest zajęty|Spritmonitor je zaneprázdnený|Spritmonitor je zaneprázdněný|Spritmonitor è occupato|Spritmonitor перегружен
Spritmonitor unavailable|A Spritmonitor nem elérhető|Spritmonitor jest niedostępny|Spritmonitor je nedostupný|Spritmonitor je nedostupný|Spritmonitor non disponibile|Spritmonitor недоступен
Could not reach Spritmonitor.|Nem sikerült kapcsolódni a Spritmonitorhoz.|Nie udało się połączyć ze Spritmonitor.|Nepodarilo sa spojiť so Spritmonitorom.|Nepodařilo se spojit se Spritmonitorem.|Impossibile raggiungere Spritmonitor.|Не удалось связаться со Spritmonitor.
Unexpected response from Spritmonitor.|Váratlan válasz a Spritmonitortól.|Nieoczekiwana odpowiedź ze Spritmonitor.|Neočakávaná odpoveď zo Spritmonitoru.|Neočekávaná odpověď ze Spritmonitoru.|Risposta inattesa da Spritmonitor.|Неожиданный ответ Spritmonitor.
Waiting for Spritmonitor tank, fuel sort or units|Várakozás a tartály, üzemanyag vagy mértékegység adataira|Oczekiwanie na dane baku, paliwa lub jednostek|Čakám na údaje o nádrži, palive alebo jednotkách|Čekám na údaje o nádrži, palivu nebo jednotkách|In attesa dei dati di serbatoio, carburante o unità|Ожидание данных о баке, топливе или единицах
pending|függőben|oczekuje|čaká|čeká|in attesa|в ожидании
unconfirmed in Spritmonitor|nincs megerősítve a Spritmonitorban|niepotwierdzone w Spritmonitor|nepotvrdené v Spritmonitore|nepotvrzeno ve Spritmonitoru|non confermati in Spritmonitor|не подтверждено в Spritmonitor
rejected by Spritmonitor|a Spritmonitor elutasította|odrzucone przez Spritmonitor|odmietnuté Spritmonitorom|odmítnuto Spritmonitorem|rifiutati da Spritmonitor|отклонено Spritmonitor
Local storage unavailable|A helyi tárhely nem érhető el|Pamięć lokalna niedostępna|Lokálne úložisko je nedostupné|Místní úložiště je nedostupné|Archivio locale non disponibile|Локальное хранилище недоступно
Basic data|Alapadatok|Dane podstawowe|Základné údaje|Základní údaje|Dati di base|Основные данные
Fuelling|Tankolás|Tankowanie|Tankovanie|Tankování|Rifornimento|Заправка
Fuel|Üzemanyag|Paliwo|Palivo|Palivo|Carburante|Топливо
Date|Dátum|Data|Dátum|Datum|Data|Дата
Type|Típus|Typ|Typ|Typ|Tipo|Тип
Full|Teljes tankolás|Do pełna|Plná nádrž|Plná nádrž|Pieno|Полный бак
Partial|Részleges tankolás|Częściowe|Čiastočné tankovanie|Částečné tankování|Parziale|Частичная заправка
Odometer|Kilométeróra|Stan licznika|Stav odometra|Stav počítadla|Contachilometri|Одометр
Trip odometer|Napi kilométeróra|Licznik dzienny|Denné počítadlo|Denní počítadlo|Contachilometri parziale|Счётчик поездки
Refilled quantity|Tankolt mennyiség|Zatankowana ilość|Natankované množstvo|Natankované množství|Quantità rifornita|Заправленный объём
Fuel sort|Üzemanyagfajta|Rodzaj paliwa|Druh paliva|Druh paliva|Tipo di carburante|Вид топлива
Price|Ár|Cena|Cena|Cena|Prezzo|Цена
Currency|Pénznem|Waluta|Mena|Měna|Valuta|Валюта
Price mode|Ár típusa|Rodzaj ceny|Typ ceny|Typ ceny|Tipo di prezzo|Тип цены
Total|Összesen|Łącznie|Celková cena|Celková cena|Totale|Итого
Per unit|Egységenként|Za jednostkę|Za jednotku|Za jednotku|Per unità|За единицу
Quantity unit|Mennyiség egysége|Jednostka ilości|Jednotka množstva|Jednotka množství|Unità di quantità|Единица объёма
Unit|Egység|Jednostka|Jednotka|Jednotka|Unità|Единица
Note|Megjegyzés|Notatka|Poznámka|Poznámka|Nota|Заметка
Gas Station|Töltőállomás|Stacja paliw|Čerpacia stanica|Čerpací stanice|Distributore|АЗС
Company|Cég|Firma|Spoločnosť|Společnost|Compagnia|Компания
Country|Ország|Kraj|Krajina|Země|Paese|Страна
City|Település|Miejscowość|Mesto|Město|Località|Населённый пункт
Driving conditions|Vezetési körülmények|Warunki jazdy|Podmienky jazdy|Podmínky jízdy|Condizioni di guida|Условия движения
Tires|Gumiabroncsok|Opony|Pneumatiky|Pneumatiky|Pneumatici|Шины
Summer|Nyári|Letnie|Letné|Letní|Estivi|Летние
Winter|Téli|Zimowe|Zimné|Zimní|Invernali|Зимние
All-season|Négyévszakos|Całoroczne|Celoročné|Celoroční|Quattro stagioni|Всесезонные
Driving style|Vezetési stílus|Styl jazdy|Štýl jazdy|Styl jízdy|Stile di guida|Стиль вождения
Slow|Nyugodt|Spokojny|Pokojný|Klidný|Tranquillo|Спокойный
Normal|Normál|Normalny|Normálny|Normální|Normale|Обычный
Fast|Gyors|Szybki|Rýchly|Rychlý|Veloce|Быстрый
Routes|Úttípusok|Rodzaje dróg|Typy ciest|Typy silnic|Tipi di strada|Типы дорог
Motorway|Autópálya|Autostrada|Diaľnica|Dálnice|Autostrada|Автомагистраль
Country roads|Országút|Drogi pozamiejskie|Mimo mesta|Mimo město|Strade extraurbane|Загородные дороги
Extras|Kiegészítők|Dodatki|Doplnky|Doplňky|Accessori|Дополнительно
A/C|Légkondicionáló|Klimatyzacja|Klimatizácia|Klimatizace|Climatizzatore|Кондиционер
Trailer|Utánfutó|Przyczepa|Príves|Přívěs|Rimorchio|Прицеп
Park heating|Állófűtés|Ogrzewanie postojowe|Nezávislé kúrenie|Nezávislé topení|Riscaldamento autonomo|Автономный отопитель
Board Computer (BC1)|Fedélzeti számítógép (BC1)|Komputer pokładowy (BC1)|Palubný počítač (BC1)|Palubní počítač (BC1)|Computer di bordo (BC1)|Бортовой компьютер (BC1)
Consumption|Fogyasztás|Spalanie|Spotreba|Spotřeba|Consumo|Расход
Quantity|Mennyiség|Ilość|Množstvo|Množství|Quantità|Объём
Avg. speed|Átlagsebesség|Średnia prędkość|Priemerná rýchlosť|Průměrná rychlost|Velocità media|Средняя скорость
Unavailable|Nem elérhető|Niedostępne|Nedostupné|Nedostupné|Non disponibile|Недоступно
Fuel tank|Üzemanyagtartály|Bak paliwa|Palivová nádrž|Palivová nádrž|Serbatoio carburante|Топливный бак
Fuel tank capacity unavailable|A tartály térfogata nem elérhető|Pojemność baku jest niedostępna|Objem nádrže je nedostupný|Objem nádrže je nedostupný|Capacità del serbatoio non disponibile|Объём бака недоступен
No tanks found|Nem található tartály|Nie znaleziono zbiorników|Nenašli sa žiadne nádrže|Nebyly nalezeny žádné nádrže|Nessun serbatoio trovato|Баки не найдены
Average consumption|Átlagfogyasztás|Średnie spalanie|Priemerná spotreba|Průměrná spotřeba|Consumo medio|Средний расход
Recorded distance|Rögzített távolság|Zapisany dystans|Zaznamenaná vzdialenosť|Zaznamenaná vzdálenost|Distanza registrata|Записанное расстояние
Recorded quantity|Rögzített mennyiség|Zapisana ilość|Zaznamenané množstvo|Zaznamenané množství|Quantità registrata|Записанный объём
Fuel costs|Üzemanyagköltség|Koszt paliwa|Náklady na palivo|Náklady na palivo|Costo del carburante|Расходы на топливо
Latest fill-up|Utolsó tankolás|Ostatnie tankowanie|Posledné tankovanie|Poslední tankování|Ultimo rifornimento|Последняя заправка
No fill-ups yet|Még nincs tankolás|Brak tankowań|Zatiaľ bez tankovaní|Zatím bez tankování|Ancora nessun rifornimento|Заправок пока нет
Distance|Távolság|Dystans|Vzdialenosť|Vzdálenost|Distanza|Расстояние
Unit price|Egységár|Cena jednostkowa|Cena za jednotku|Cena za jednotku|Prezzo unitario|Цена за единицу
Back to summary|Vissza az összesítőhöz|Wróć do podsumowania|Späť na prehľad|Zpět na přehled|Torna al riepilogo|Назад к сводке
Could not load fill-ups|A tankolások betöltése sikertelen|Nie udało się wczytać tankowań|Tankovania sa nepodarilo načítať|Tankování se nepodařilo načíst|Impossibile caricare i rifornimenti|Не удалось загрузить заправки
No data for this chart|Nincs adat a diagramhoz|Brak danych do wykresu|Pre graf nie sú údaje|Pro graf nejsou údaje|Nessun dato per il grafico|Нет данных для графика
points|pont|punktów|bodov|bodů|punti|точек
Connect a vehicle in My Car first.|Előbb csatlakoztass járművet az Autóm lapon.|Najpierw połącz pojazd w zakładce Mój samochód.|Najprv pripoj vozidlo v časti Moje auto.|Nejprve připoj vozidlo v části Moje auto.|Collega prima un veicolo in La mia auto.|Сначала подключите автомобиль в разделе «Мой автомобиль».
Local storage is unavailable.|A helyi tárhely nem érhető el.|Pamięć lokalna jest niedostępna.|Lokálne úložisko je nedostupné.|Místní úložiště je nedostupné.|L’archivio locale non è disponibile.|Локальное хранилище недоступно.
Select a fuelling type.|Válaszd ki a tankolás típusát.|Wybierz typ tankowania.|Vyber typ tankovania.|Vyber typ tankování.|Seleziona il tipo di rifornimento.|Выберите тип заправки.
Enter the refilled quantity.|Add meg a tankolt mennyiséget.|Wpisz zatankowaną ilość.|Zadaj natankované množstvo.|Zadej natankované množství.|Inserisci la quantità rifornita.|Введите заправленный объём.
Enter the price.|Add meg az árat.|Wpisz cenę.|Zadaj cenu.|Zadej cenu.|Inserisci il prezzo.|Введите цену.
Trip data are unavailable.|Az útadatok nem érhetők el.|Dane podróży są niedostępne.|Údaje o jazde sú nedostupné.|Údaje o jízdě jsou nedostupné.|I dati di viaggio non sono disponibili.|Данные поездки недоступны.
Could not save the entry locally.|A bejegyzés nem menthető helyben.|Nie udało się zapisać wpisu lokalnie.|Záznam sa nepodarilo uložiť lokálne.|Záznam se nepodařilo uložit místně.|Impossibile salvare la voce in locale.|Не удалось сохранить запись локально.
Saved in iDrive.|Mentve az iDrive-ban.|Zapisano w iDrive.|Uložené v iDrive.|Uloženo v iDrive.|Salvato in iDrive.|Сохранено в iDrive.
Saved and sent to Spritmonitor.|Mentve és elküldve a Spritmonitorba.|Zapisano i wysłano do Spritmonitor.|Uložené a odoslané do Spritmonitoru.|Uloženo a odesláno do Spritmonitoru.|Salvato e inviato a Spritmonitor.|Сохранено и отправлено в Spritmonitor.
Saved in iDrive. Syncing with Spritmonitor...|Mentve az iDrive-ban. Szinkronizálás a Spritmonitorral…|Zapisano w iDrive. Synchronizacja ze Spritmonitor…|Uložené v iDrive. Synchronizujem so Spritmonitorom…|Uloženo v iDrive. Synchronizuji se Spritmonitorem…|Salvato in iDrive. Sincronizzazione con Spritmonitor…|Сохранено в iDrive. Синхронизация со Spritmonitor…
Saved in iDrive. Check Spritmonitor before adding it again.|Mentve az iDrive-ban. Új rögzítés előtt ellenőrizd a Spritmonitort.|Zapisano w iDrive. Przed ponownym dodaniem sprawdź Spritmonitor.|Uložené v iDrive. Pred opätovným pridaním skontroluj Spritmonitor.|Uloženo v iDrive. Před opětovným přidáním zkontroluj Spritmonitor.|Salvato in iDrive. Controlla Spritmonitor prima di aggiungerlo di nuovo.|Сохранено в iDrive. Перед повторным добавлением проверьте Spritmonitor.
Saved in iDrive. Spritmonitor rejected the entry.|Mentve az iDrive-ban. A Spritmonitor elutasította a bejegyzést.|Zapisano w iDrive. Spritmonitor odrzucił wpis.|Uložené v iDrive. Spritmonitor záznam odmietol.|Uloženo v iDrive. Spritmonitor záznam odmítl.|Salvato in iDrive. Spritmonitor ha rifiutato la voce.|Сохранено в iDrive. Spritmonitor отклонил запись.
Saved offline. Will send when the connection returns.|Mentve offline. Kapcsolat esetén elküldjük.|Zapisano offline. Wysyłka po odzyskaniu połączenia.|Uložené offline. Odošle sa po obnovení pripojenia.|Uloženo offline. Odešle se po obnovení připojení.|Salvato offline. Invio al ripristino della connessione.|Сохранено офлайн. Отправка после восстановления связи.
Saved in iDrive. Waiting to send.|Mentve az iDrive-ban. Küldésre vár.|Zapisano w iDrive. Oczekuje na wysłanie.|Uložené v iDrive. Čaká na odoslanie.|Uloženo v iDrive. Čeká na odeslání.|Salvato in iDrive. In attesa di invio.|Сохранено в iDrive. Ожидание отправки.
Nearby town from GPS (GeoNames)|Közeli település GPS alapján (GeoNames)|Pobliska miejscowość z GPS (GeoNames)|Blízka obec podľa GPS (GeoNames)|Blízká obec podle GPS (GeoNames)|Località vicina da GPS (GeoNames)|Ближайший населённый пункт по GPS (GeoNames)
No clear nearby town in offline data|Nincs egyértelmű közeli település az offline adatokban|Brak jednoznacznej pobliskiej miejscowości offline|V offline údajoch nie je jednoznačná obec v okolí|V offline datech není jednoznačná obec v okolí|Nessuna località vicina certa nei dati offline|В офлайн-данных нет однозначного населённого пункта
Offline town data unavailable|Az offline településadatok nem elérhetők|Dane miejscowości offline są niedostępne|Offline údaje o obciach sú nedostupné|Offline údaje o obcích jsou nedostupné|Dati offline delle località non disponibili|Офлайн-данные о населённых пунктах недоступны
Navigation signal unavailable|A navigációs jel nem elérhető|Sygnał nawigacji niedostępny|Navigačný signál je nedostupný|Navigační signál je nedostupný|Segnale di navigazione non disponibile|Сигнал навигации недоступен
No recent navigation data|Nincs friss navigációs adat|Brak aktualnych danych nawigacji|Žiadne aktuálne údaje navigácie|Žádné aktuální údaje navigace|Nessun dato di navigazione recente|Нет свежих данных навигации
No city or country|Nincs település vagy ország|Brak miejscowości lub kraju|Chýba mesto alebo krajina|Chybí město nebo země|Località o paese mancanti|Нет населённого пункта или страны
GPS position available|A GPS-pozíció elérhető|Pozycja GPS dostępna|GPS poloha je dostupná|GPS poloha je dostupná|Posizione GPS disponibile|Позиция GPS доступна
GPS coordinates invalid or unsupported|Érvénytelen vagy nem támogatott GPS-koordináták|Nieprawidłowe lub nieobsługiwane współrzędne GPS|Neplatné alebo nepodporované GPS súradnice|Neplatné nebo nepodporované souřadnice GPS|Coordinate GPS non valide o non supportate|Координаты GPS неверны или не поддерживаются
Navigation sent country only|A navigáció csak az országot adta meg|Nawigacja podała tylko kraj|Navigácia poskytla iba krajinu|Navigace poskytla pouze zemi|La navigazione ha fornito solo il paese|Навигация передала только страну
Navigation sent city only|A navigáció csak a települést adta meg|Nawigacja podała tylko miejscowość|Navigácia poskytla iba mesto|Navigace poskytla pouze město|La navigazione ha fornito solo la località|Навигация передала только населённый пункт
City and country received from navigation|Település és ország a navigációból|Miejscowość i kraj z nawigacji|Mesto a krajina z navigácie|Město a země z navigace|Località e paese dalla navigazione|Населённый пункт и страна получены из навигации
Report a bug|Hiba jelentése|Zgłoś błąd|Nahlásiť chybu|Nahlásit chybu|Segnala un errore|Сообщить об ошибке
Request a feature|Funkció javaslata|Zaproponuj funkcję|Navrhnúť funkciu|Navrhnout funkci|Proponi una funzione|Предложить функцию
Third-party app for Spritmonitor.de.|Külső alkalmazás a Spritmonitor.de-hez.|Aplikacja innej firmy dla Spritmonitor.de.|Aplikácia tretej strany pre Spritmonitor.de.|Aplikace třetí strany pro Spritmonitor.de.|App di terze parti per Spritmonitor.de.|Стороннее приложение для Spritmonitor.de.
Log fuel and AdBlue refills from BMW iDrive 7.|Üzemanyag és AdBlue rögzítése BMW iDrive 7-ben.|Zapisuj tankowania paliwa i AdBlue w BMW iDrive 7.|Zaznamenávaj tankovanie paliva a AdBlue v BMW iDrive 7.|Zaznamenávej tankování paliva a AdBlue v BMW iDrive 7.|Registra rifornimenti di carburante e AdBlue da BMW iDrive 7.|Записывайте заправки топлива и AdBlue в BMW iDrive 7.
Developed by dzooky@bmrmodz|Fejlesztő: dzooky@bmrmodz|Autor: dzooky@bmrmodz|Autor: dzooky@bmrmodz|Autor: dzooky@bmrmodz|Sviluppato da dzooky@bmrmodz|Разработчик: dzooky@bmrmodz
What's new|Újdonságok|Co nowego|Novinky|Novinky|Novità|Что нового
Austria|Ausztria|Austria|Rakúsko|Rakousko|Austria|Австрия
Belgium|Belgium|Belgia|Belgicko|Belgie|Belgio|Бельгия
Croatia|Horvátország|Chorwacja|Chorvátsko|Chorvatsko|Croazia|Хорватия
Czechia|Csehország|Czechy|Česko|Česko|Cechia|Чехия
France|Franciaország|Francja|Francúzsko|Francie|Francia|Франция
Germany|Németország|Niemcy|Nemecko|Německo|Germania|Германия
Hungary|Magyarország|Węgry|Maďarsko|Maďarsko|Ungheria|Венгрия
Italy|Olaszország|Włochy|Taliansko|Itálie|Italia|Италия
Netherlands|Hollandia|Niderlandy|Holandsko|Nizozemsko|Paesi Bassi|Нидерланды
Poland|Lengyelország|Polska|Poľsko|Polsko|Polonia|Польша
Romania|Románia|Rumunia|Rumunsko|Rumunsko|Romania|Румыния
Slovakia|Szlovákia|Słowacja|Slovensko|Slovensko|Slovacchia|Словакия
Slovenia|Szlovénia|Słowenia|Slovinsko|Slovinsko|Slovenia|Словения
Switzerland|Svájc|Szwajcaria|Švajčiarsko|Švýcarsko|Svizzera|Швейцария
`;

const languages = ['hu', 'pl', 'sk', 'cs', 'it', 'ru'];
const catalogs = {};
for (const lang of languages) catalogs[lang] = {};
for (const row of text.trim().split('\n')) {
    const [key, ...translations] = row.split('|');
    languages.forEach((lang, index) => { catalogs[lang][key] = translations[index]; });
}
module.exports = catalogs;
