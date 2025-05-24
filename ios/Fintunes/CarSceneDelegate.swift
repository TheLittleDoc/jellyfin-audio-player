import CarPlay

class CarSceneDelegate: UIResponder, CPTemplateApplicationSceneDelegate {
    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didConnect interfaceController: CPInterfaceController) {
        print("CarPlay: Scene did connect")
        print("CarPlay: About to connect to RNCarPlay")
        // Dispatch connect to RNCarPlay
        RNCarPlay.connect(with: interfaceController, window: templateApplicationScene.carWindow)
        print("CarPlay: RNCarPlay.connect called")
    }
    
    func templateApplicationScene(_ templateApplicationScene: CPTemplateApplicationScene, didDisconnect interfaceController: CPInterfaceController) {
        print("CarPlay: Scene did disconnect")
        // Dispatch disconnect to RNCarPlay
        RNCarPlay.disconnect()
    }
} 