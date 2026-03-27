import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'api_client.dart';

class RemindersApi {
  final Dio _dio;
  const RemindersApi(this._dio);

  Future<void> scheduleFcm({
    required String fcmToken,
    required String title,
    required String body,
    required String tag,
    required int fireAt,
  }) async {
    await _dio.post('/reminders/fcm', data: {
      'fcmToken': fcmToken,
      'title': title,
      'body': body,
      'tag': tag,
      'fireAt': fireAt,
    });
  }
}

final remindersApiProvider = Provider<RemindersApi>(
  (ref) => RemindersApi(ref.watch(dioProvider)),
);
