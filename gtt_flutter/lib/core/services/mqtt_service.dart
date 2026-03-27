import 'dart:async';
import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:mqtt_client/mqtt_client.dart';
import 'package:mqtt_client/mqtt_server_client.dart';
import '../models/vehicle.dart';

class MqttService {
  static const _host = 'mapi.5t.torino.it';
  static const _port = 443;
  static const _topic = '#';

  MqttServerClient? _client;
  final _vehicleController = StreamController<Vehicle>.broadcast();

  Stream<Vehicle> get vehicleStream => _vehicleController.stream;

  Future<void> connect() async {
    _client = MqttServerClient.withPort(_host, 'gtt_flutter_client', _port);
    _client!.useWebSocket = true;
    _client!.websocketProtocols = ['mqtt'];
    _client!.keepAlivePeriod = 30;
    _client!.autoReconnect = true;
    _client!.onDisconnected = _onDisconnected;

    final connMsg = MqttConnectMessage()
        .withClientIdentifier('gtt_flutter_${DateTime.now().millisecondsSinceEpoch}')
        .startClean();
    _client!.connectionMessage = connMsg;

    try {
      await _client!.connect();
    } catch (e) {
      _client!.disconnect();
      return;
    }

    if (_client!.connectionStatus?.state == MqttConnectionState.connected) {
      _client!.subscribe(_topic, MqttQos.atMostOnce);
      _client!.updates?.listen(_onMessage);
    }
  }

  void _onMessage(List<MqttReceivedMessage<MqttMessage?>>? messages) {
    if (messages == null) return;
    for (final msg in messages) {
      final recMsg = msg.payload as MqttPublishMessage;
      final payload = MqttPublishPayload.bytesToStringAsString(
        recMsg.payload.message,
      );
      try {
        final data = jsonDecode(payload) as Map<String, dynamic>;
        final vehicle = Vehicle.fromJson(data);
        _vehicleController.add(vehicle);
      } catch (_) {
        // payload non è un veicolo, ignora
      }
    }
  }

  void _onDisconnected() {
    // auto-reconnect gestito dal client
  }

  void disconnect() {
    _client?.disconnect();
    _vehicleController.close();
  }
}

final mqttServiceProvider = Provider<MqttService>((ref) {
  final service = MqttService();
  ref.onDispose(service.disconnect);
  return service;
});
