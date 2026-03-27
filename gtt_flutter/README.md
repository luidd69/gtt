# GTT Flutter — App Android

App Android nativa per il trasporto pubblico GTT Torino, costruita con Flutter.

## Prerequisiti

- Flutter SDK ≥ 3.22 (`flutter doctor`)
- Android Studio + emulatore API 26+
- Backend GTT in esecuzione su porta `3011`
- (Opzionale) Firebase project per notifiche push FCM

## Avvio rapido

```bash
# 1. Installa dipendenze
flutter pub get

# 2. Configura l'IP del backend
# Modifica lib/core/api/api_client.dart → kBaseUrl
# In emulatore Android: usa 10.0.2.2:3011

# 3. Lancia su emulatore o dispositivo
flutter run

# Build APK debug
flutter build apk --debug

# Build APK release (richiede keystore configurato)
flutter build apk --release
```

## Note Firebase (FCM)

```bash
dart pub global activate flutterfire_cli
flutterfire configure --project=TUO-PROGETTO-FIREBASE
```

Aggiunge automaticamente `android/app/google-services.json`.

## Struttura progetto

```
lib/
├── main.dart                  # Entry point
├── core/
│   ├── api/                   # Dio HTTP clients per ogni endpoint
│   ├── models/                # Classi dati (Stop, Arrival, Itinerary, …)
│   ├── providers/             # Riverpod: favorites, theme, location
│   ├── services/              # MQTT, notifiche, reminder scheduler
│   ├── theme/                 # MaterialTheme light/dark + colori
│   └── router/                # GoRouter con tutte le route
└── features/
    ├── home/                  # HomeScreen
    ├── search/                # SearchScreen
    ├── stop_detail/           # StopDetailScreen + ArrivalRow
    ├── journey/               # JourneyPlannerScreen + ItineraryDetailScreen
    ├── map/                   # VehicleMapScreen (flutter_map + OSM)
    ├── reminders/             # RemindersScreen
    └── info/                  # InfoScreen (avvisi di servizio)
```

## Backend API utilizzate

| Endpoint | Uso |
|---|---|
| `GET /api/stops/search?q=` | Ricerca fermate |
| `GET /api/stops/nearby` | Fermate vicine |
| `GET /api/stops/:stopId` | Dettaglio fermata |
| `GET /api/arrivals/:stopId` | Prossimi arrivi |
| `GET /api/journey/search` | Pianifica tragitto (OTP) |
| `GET /api/service/status` | Alert di servizio |
| `GET /api/service/vehicles` | Veicoli live (fallback MQTT) |
| `POST /api/reminders/fcm` | Schedula push FCM |

## Variabili d'ambiente

```dart
// lib/core/api/api_client.dart
const String kBaseUrl = String.fromEnvironment(
  'GTT_API_URL',
  defaultValue: 'http://10.0.2.2:3011/api',
);
```

Per passare un URL diverso in build:
```bash
flutter run --dart-define=GTT_API_URL=http://192.168.1.100:3011/api
```
