# GTT App — Piano di Migrazione Flutter (Android)

> **Obiettivo:** Convertire la web app GTT in un'app Android nativa Flutter.
> **Strategia:** Il backend Node.js/Express resta invariato. Si riscrive solo il layer UI in Flutter/Dart, puntando alle stesse API REST già esistenti.

---

## Prerequisiti

- Flutter SDK ≥ 3.22 installato
- Android Studio + emulatore (API 26+, Android 8.0 minimo)
- Backend GTT già funzionante (stesso server, stessa `.env`)
- Account Firebase (gratis, per FCM notifiche)
- Dart 3.x (incluso con Flutter)

---

## Stack Flutter scelto

| Funzione | Package | Versione consigliata |
|---|---|---|
| HTTP client | `dio` | ^5.4 |
| State management | `flutter_riverpod` | ^2.5 |
| Routing | `go_router` | ^14.0 |
| Persistenza locale | `shared_preferences` | ^2.3 |
| Mappe | `flutter_map` + `latlong2` | ^6.1 |
| MQTT (veicoli live) | `mqtt_client` | ^10.0 |
| Notifiche push | `firebase_messaging` | ^15.0 |
| Notifiche locali | `flutter_local_notifications` | ^17.0 |
| Geolocalizzazione | `geolocator` | ^12.0 |
| Geocoding | `geocoding` | ^3.0 |
| Icone | `material_symbols_icons` | ^4.2 |
| Animazioni | `flutter_animate` | ^4.5 |
| Cache immagini | `cached_network_image` | ^3.3 |
| Intl/date | `intl` | ^0.19 |

---

## Struttura progetto Flutter

```
gtt_flutter/
├── android/
│   └── app/
│       ├── google-services.json        ← Firebase (FCM)
│       └── src/main/AndroidManifest.xml
├── lib/
│   ├── main.dart                       ← entry point, ProviderScope, Router
│   ├── core/
│   │   ├── api/
│   │   │   ├── api_client.dart         ← Dio singleton + interceptors
│   │   │   ├── stops_api.dart          ← /api/stops/*
│   │   │   ├── arrivals_api.dart       ← /api/arrivals/:stopId
│   │   │   ├── lines_api.dart          ← /api/lines/*
│   │   │   ├── journey_api.dart        ← /api/journey/*
│   │   │   ├── service_api.dart        ← /api/service/*
│   │   │   ├── trips_api.dart          ← /api/trips/:tripId/live
│   │   │   └── reminders_api.dart      ← /api/reminders (FCM)
│   │   ├── models/
│   │   │   ├── stop.dart
│   │   │   ├── arrival.dart
│   │   │   ├── route_line.dart
│   │   │   ├── itinerary.dart
│   │   │   ├── leg.dart
│   │   │   ├── vehicle.dart
│   │   │   └── reminder.dart
│   │   ├── providers/
│   │   │   ├── favorites_provider.dart ← SharedPreferences persist
│   │   │   ├── theme_provider.dart     ← dark/light mode
│   │   │   └── location_provider.dart  ← geolocator stream
│   │   ├── services/
│   │   │   ├── mqtt_service.dart       ← wss://mapi.5t.torino.it/scre
│   │   │   ├── notification_service.dart ← FCM + local notifications
│   │   │   └── reminder_service.dart   ← scheduling logic
│   │   ├── theme/
│   │   │   ├── app_theme.dart          ← MaterialApp ThemeData
│   │   │   └── colors.dart             ← equivalente CSS variables V2
│   │   └── router/
│   │       └── app_router.dart         ← GoRouter con tutte le route
│   ├── features/
│   │   ├── home/
│   │   │   ├── home_screen.dart        ← HomeV2
│   │   │   └── home_provider.dart
│   │   ├── search/
│   │   │   ├── search_screen.dart      ← SearchV2
│   │   │   └── search_provider.dart
│   │   ├── stop_detail/
│   │   │   ├── stop_detail_screen.dart ← StopDetailV2
│   │   │   ├── arrival_row.dart        ← ArrivalRow
│   │   │   └── arrivals_provider.dart
│   │   ├── journey/
│   │   │   ├── journey_planner_screen.dart  ← JourneyPlannerV2
│   │   │   ├── itinerary_detail_screen.dart ← ItineraryDetailV2
│   │   │   └── journey_provider.dart
│   │   ├── map/
│   │   │   ├── vehicle_map_screen.dart ← VehicleMap
│   │   │   └── map_provider.dart
│   │   ├── reminders/
│   │   │   ├── reminders_screen.dart   ← RemindersV2
│   │   │   └── reminders_provider.dart
│   │   └── info/
│   │       └── info_screen.dart        ← InfoV2
│   └── widgets/
│       ├── bottom_nav.dart             ← BottomNavigationBar (5 tab)
│       ├── route_chip.dart             ← RouteChip (badge linea colorato)
│       ├── delay_badge.dart            ← DelayBadge
│       ├── stop_card.dart              ← StopCard
│       └── loading_shimmer.dart        ← shimmer al posto di spinner
├── pubspec.yaml
└── .env / config.dart                  ← URL backend configurabile
```

---

## Fase 1 — Setup progetto (Giorno 1)

### 1.1 Crea il progetto Flutter
```bash
flutter create --org it.gtt --platforms android gtt_flutter
cd gtt_flutter
```

### 1.2 Aggiungi dipendenze in `pubspec.yaml`
```yaml
dependencies:
  flutter:
    sdk: flutter
  dio: ^5.4.0
  flutter_riverpod: ^2.5.0
  go_router: ^14.0.0
  shared_preferences: ^2.3.0
  flutter_map: ^6.1.0
  latlong2: ^0.9.0
  mqtt_client: ^10.0.0
  firebase_core: ^3.0.0
  firebase_messaging: ^15.0.0
  flutter_local_notifications: ^17.0.0
  geolocator: ^12.0.0
  geocoding: ^3.0.0
  intl: ^0.19.0
  flutter_animate: ^4.5.0
  material_symbols_icons: ^4.2.0
```

### 1.3 Configura Dio (api_client.dart)
```dart
// Base URL puntata al backend GTT
const kBaseUrl = 'http://TUO_SERVER_IP:3011';

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(BaseOptions(
    baseUrl: kBaseUrl,
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 15),
  ));
  // Interceptor per logging in debug
  dio.interceptors.add(LogInterceptor(responseBody: true));
  return dio;
});
```

### 1.4 Configura GoRouter (app_router.dart)
```dart
final router = GoRouter(routes: [
  ShellRoute(
    builder: (context, state, child) => ScaffoldWithNav(child: child),
    routes: [
      GoRoute(path: '/',        builder: (c, s) => const HomeScreen()),
      GoRoute(path: '/search',  builder: (c, s) => const SearchScreen()),
      GoRoute(path: '/journey', builder: (c, s) => const JourneyPlannerScreen()),
      GoRoute(path: '/map',     builder: (c, s) => const VehicleMapScreen()),
      GoRoute(path: '/reminders', builder: (c, s) => const RemindersScreen()),
    ],
  ),
  GoRoute(path: '/stops/:stopId', builder: (c, s) =>
    StopDetailScreen(stopId: s.pathParameters['stopId']!)),
  GoRoute(path: '/journey/itinerary', builder: (c, s) =>
    ItineraryDetailScreen(itinerary: s.extra as Itinerary)),
  GoRoute(path: '/trips/:tripId', builder: (c, s) =>
    TripDetailScreen(tripId: s.pathParameters['tripId']!)),
]);
```

### 1.5 Setup Firebase (FCM)
```bash
# Installa FlutterFire CLI
dart pub global activate flutterfire_cli
# Configura Firebase per il progetto
flutterfire configure --project=gtt-app-XXXXX
```
- Aggiunge `google-services.json` in `android/app/`
- **Modifica backend**: aggiungere `POST /api/reminders/fcm` che accetta `{ fcmToken, title, body, fireAt }` e usa `firebase-admin` per inviare notifiche

---

## Fase 2 — Modelli dati (Giorno 1-2)

Convertire le risposte JSON del backend in classi Dart con `fromJson`.

### Esempio: `stop.dart`
```dart
class Stop {
  final String stopId;
  final String stopCode;
  final String stopName;
  final double stopLat;
  final double stopLon;
  final List<RouteLine> routes;
  final int? distanceM;

  const Stop({...});

  factory Stop.fromJson(Map<String, dynamic> json) => Stop(
    stopId: json['stopId'],
    stopCode: json['stopCode'] ?? '',
    stopName: json['stopName'],
    stopLat: (json['stopLat'] as num).toDouble(),
    stopLon: (json['stopLon'] as num).toDouble(),
    routes: (json['routes'] as List? ?? [])
        .map((r) => RouteLine.fromJson(r)).toList(),
    distanceM: json['distanceM'],
  );
}
```

**Modelli da creare (in ordine di priorità):**
1. `Stop` — usato ovunque
2. `Arrival` — StopDetail
3. `RouteLine` — linee sui chip
4. `Itinerary` + `Leg` — Journey
5. `Vehicle` — Mappa
6. `Alert` — Info/Home
7. `Reminder` — Reminders

---

## Fase 3 — Schermate core MVP (Giorni 2-5)

### 3.1 HomeScreen (HomeV2)

**Elementi:**
- Saluto dinamico (Buongiorno/Buon pomeriggio/Buonasera)
- Hero search bar → naviga a SearchScreen
- Banner alert di servizio (da `/api/service/status`)
- Griglia quick actions (Cerca Fermata, Pianifica, Mappa, Preferiti)
- Lista fermate preferite (da `shared_preferences`)
- Lista percorsi frequenti

**Provider:**
```dart
// Riverpod: alert di servizio
final serviceStatusProvider = FutureProvider((ref) =>
  ref.watch(serviceApiProvider).getStatus());

// Riverpod: preferiti persistenti
final favoritesProvider = NotifierProvider<FavoritesNotifier, FavoritesState>(
  FavoritesNotifier.new);
```

### 3.2 SearchScreen (SearchV2)

**Elementi:**
- `SearchBar` nativa Material 3 con debounce 300ms
- `ListView` con risultati da `/api/stops/search?q=`
- Sezione "Vicino a te" con fermate da `/api/stops/nearby`
- `StopCard` widget riutilizzabile

**Logica:**
```dart
final searchProvider = StateNotifierProvider<SearchNotifier, SearchState>(
  SearchNotifier.new);

// Debounce manuale con Timer
void onQueryChanged(String q) {
  _debounce?.cancel();
  _debounce = Timer(const Duration(milliseconds: 300), () {
    if (q.length >= 2) _search(q);
  });
}
```

### 3.3 StopDetailScreen (StopDetailV2)

**Elementi:**
- Header fermata (nome, codice, linee chip)
- `ListView` di `ArrivalRow` (max 20 arrivi)
- Auto-refresh ogni 30 secondi
- Badge realtime/scheduled
- Pulsante ⭐ aggiungi preferiti
- Pulsante ⏰ reminder per ogni arrivo

**Provider:**
```dart
// Auto-refresh con StreamProvider
final arrivalsProvider = StreamProvider.family<List<Arrival>, String>((ref, stopId) =>
  Stream.periodic(const Duration(seconds: 30), (_) => 0)
    .asyncMap((_) => ref.read(arrivalsApiProvider).getArrivals(stopId))
    .startWith(ref.read(arrivalsApiProvider).getArrivals(stopId)));
```

### 3.4 BottomNav (BottomNavV2)

**5 tab:**
```
Home | Cerca | Pianifica | Mappa | Info
 🏠     🔍      🗺️         📍     ℹ️
```

---

## Fase 4 — Funzionalità avanzate (Giorni 5-10)

### 4.1 JourneyPlannerScreen (JourneyPlannerV2)

**Elementi:**
- 2 campi stop picker (Partenza / Arrivo) con autocomplete
- Geolocalizzazione per "posizione corrente"
- Selettore Parti Ora / Parti alle / Arriva alle
- DateTimePicker per ora personalizzata
- Lista itinerari risultanti
- Badge "Più veloce" / "Meno cambi" / "Prima partenza"

**Chiamata API:**
```
GET /api/journey/search?from=STOP_ID&to=STOP_ID
  oppure con OTP (multi-leg):
GET /api/journey/search?fromLat=&fromLon=&toLat=&toLon=
```

### 4.2 ItineraryDetailScreen (ItineraryDetailV2)

**Elementi:**
- Header riepilogo (orario partenza → arrivo, durata, cambi)
- Timeline verticale con legs:
  - `WalkLeg`: linea tratteggiata + icona pedone + distanza
  - `TransitLeg`: linea colorata + chip linea + fermate intermedie collassabili
- Pulsante "Avvia GPS" per proximity alert
- Reminder per fermata di salita
- CTA fissa in basso "Ricerca alternativa"

### 4.3 VehicleMapScreen (VehicleMap)

**Elementi:**
- `FlutterMap` con `OpenStreetMap` tile layer
- Marker veicoli live (aggiornati via MQTT)
- Marker fermate con popup
- Clustering marker
- Pulsante "Centra su di me"

**MQTT:**
```dart
class MqttService {
  final MqttServerClient _client;

  Future<void> connect() async {
    _client.server = 'mapi.5t.torino.it';
    _client.port = 443;
    _client.websocketProtocols = ['mqtt'];
    await _client.connect();
    _client.subscribe('#', MqttQos.atMostOnce);
  }

  Stream<Vehicle> get vehicleStream => _client.updates!
    .expand((msgs) => msgs)
    .map(_parsePayload);
}
```

### 4.4 RemindersScreen (RemindersV2)

**Elementi:**
- Lista reminder attivi (da `shared_preferences` locale)
- Card per ogni reminder con countdown
- Pulsante cancella
- Notifica locale schedulata (anche se app chiusa: FCM)

**Flusso reminder:**
```
User clicca ⏰ su ArrivalRow
  → Richiedi permission notifiche (Android 13+)
  → Invia token FCM al backend POST /api/reminders/fcm
  → Salva reminder in shared_preferences per UI
  → Backend invia FCM push a fireAt
  → flutter_local_notifications mostra notifica
```

---

## Fase 5 — Modifica backend per FCM (Giorno 8-9)

### Aggiungere `firebase-admin` al backend
```bash
cd backend
npm install firebase-admin
```

### Nuovo file `backend/src/routes/reminders-fcm.js`
```javascript
const admin = require('firebase-admin');

// Init (serviceAccount da file JSON o env)
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))
});

// POST /api/reminders/fcm
router.post('/fcm', (req, res) => {
  const { fcmToken, title, body, tag, fireAt } = req.body;
  // Schedula invio push a fireAt
  const delay = fireAt - Date.now();
  setTimeout(async () => {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      android: { priority: 'high', notification: { tag } }
    });
  }, delay);
  res.json({ ok: true });
});
```

**Variabili `.env` da aggiungere:**
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
```

---

## Fase 6 — Theme e Polish (Giorno 10-12)

### `app_theme.dart` — equivalente CSS variables V2
```dart
class AppColors {
  // Light
  static const brand = Color(0xFF2563EB);        // --v2-brand
  static const surface1 = Color(0xFFFFFFFF);     // --v2-surface-1
  static const surface2 = Color(0xFFF8F9FA);     // --v2-surface-2
  static const text1 = Color(0xFF0F172A);        // --v2-text-1
  static const text3 = Color(0xFF94A3B8);        // --v2-text-3
  static const onTime = Color(0xFF16A34A);       // --v2-on-time
  static const delayed = Color(0xFFE8431B);      // --v2-delay-heavy

  // Dark (da CSS dark vars)
  static const darkSurface1 = Color(0xFF0F172A);
  static const darkSurface2 = Color(0xFF1E293B);
  static const darkText1 = Color(0xFFF1F5F9);
}

ThemeData lightTheme() => ThemeData(
  useMaterial3: true,
  colorScheme: ColorScheme.fromSeed(seedColor: AppColors.brand),
  // font: Inter (Google Fonts)
);
```

### Widget `RouteChip`
```dart
class RouteChip extends StatelessWidget {
  final String shortName;
  final String? color;
  final String? textColor;

  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
    decoration: BoxDecoration(
      color: color != null ? Color(int.parse('FF$color', radix: 16)) : AppColors.brand,
      borderRadius: BorderRadius.circular(6),
    ),
    child: Text(shortName,
      style: TextStyle(
        color: textColor != null ? Color(int.parse('FF$textColor', radix: 16)) : Colors.white,
        fontWeight: FontWeight.w800,
        fontSize: 13,
      )),
  );
}
```

---

## Fase 7 — Build e distribuzione (Giorno 12-14)

### Build APK debug
```bash
flutter build apk --debug
# Output: build/app/outputs/flutter-apk/app-debug.apk
```

### Build APK release
```bash
# Crea keystore
keytool -genkey -v -keystore gtt-release.jks -alias gtt -keyalg RSA -keysize 2048 -validity 10000

# Configura android/app/build.gradle con signingConfigs
flutter build apk --release
# oppure App Bundle per Play Store:
flutter build appbundle --release
```

### Configurazione `AndroidManifest.xml`
```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION"/>
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<!-- Per FCM background -->
<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED"/>
```

---

## Roadmap temporale

| Settimana | Fase | Deliverable |
|---|---|---|
| **Settimana 1** | Fase 1-2 | Progetto Flutter funzionante, tutti i modelli, Dio configurato |
| **Settimana 1-2** | Fase 3 | Home + Search + StopDetail + BottomNav (MVP funzionante) |
| **Settimana 2-3** | Fase 4 | Journey Planner + Mappa + MQTT + Reminders |
| **Settimana 3** | Fase 5 | Backend FCM, notifiche Android funzionanti |
| **Settimana 3-4** | Fase 6-7 | Theme, dark mode, build release, distribuzione |

---

## Rischi e note

| Rischio | Mitigazione |
|---|---|
| MQTT su WebSocket da Android | Testare `mqtt_client` con WSS; alternativa: polling `/api/service/vehicles` ogni 5s |
| Backend reminders in-memory | Usare `flutter_local_notifications` come fallback locale se FCM non configurato |
| Nominatim rate limiting | Aggiungere debounce 500ms + header `User-Agent` |
| Permessi geolocalizzazione Android 13 | Gestire con `permission_handler` package |
| CORS dal backend | Aggiungere IP app a `CORS_ORIGINS` in `.env` |

---

## Checklist pre-sviluppo

- [ ] Flutter SDK installato e `flutter doctor` verde
- [ ] Android Studio con emulatore API 30+ pronto
- [ ] Backend GTT raggiungibile dall'emulatore (usa IP locale, non `localhost`)
- [ ] Account Firebase creato + progetto Android configurato
- [ ] `google-services.json` ottenuto dalla Firebase Console
- [ ] Keystore per firma APK release creato e conservato in sicurezza

---

*Piano creato il 2026-03-27. Basato sull'analisi completa della web app GTT (React + Node.js + SQLite + OTP + MQTT).*
