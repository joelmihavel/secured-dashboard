/// FlentSecuredApp.swift
/// Flent Secured v2 - Main App Entry Point
///
/// Uses iOS 17+ @Observable pattern for state management
/// Coordinator pattern for navigation

import SwiftUI

@main
struct FlentSecuredApp: App {
    @State private var appState = AppState()
    @State private var coordinator = AppCoordinator()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environment(appState)
                .environment(coordinator)
                .task {
                    await appState.initialize()
                }
        }
    }
}
