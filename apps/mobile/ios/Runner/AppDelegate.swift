import Flutter
import UIKit
// TODO(maps): uncomment once the Google Maps iOS API key exists.
// import GoogleMaps

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    // TODO(maps): provide a real Google Maps API key (iOS, restricted to
    // com.pikavolt.app) before enabling map screens.
    // GMSServices.provideAPIKey("TODO_GOOGLE_MAPS_IOS_API_KEY")

    // TODO(firebase): add ios/Runner/GoogleService-Info.plist (flutterfire
    // configure) to enable FCM push notifications.
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
  }
}
