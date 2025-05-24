import UIKit
import React

class PhoneSceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(
        _ scene: UIScene, willConnectTo session: UISceneSession,
        options connectionOptions: UIScene.ConnectionOptions
    ) {
        guard let appDelegate = UIApplication.shared.delegate as? AppDelegate else { return }
        guard let windowScene = scene as? UIWindowScene else { return }
        guard let appRootView = appDelegate.window?.rootViewController?.view else { return }

        let containerViewController = UIViewController()
        containerViewController.view.addSubview(appRootView)
        appRootView.frame = containerViewController.view.bounds

        let window = UIWindow(windowScene: windowScene)
        window.rootViewController = containerViewController
        self.window = window
        window.makeKeyAndVisible()
    }
}
