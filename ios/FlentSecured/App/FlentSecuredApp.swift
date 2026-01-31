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

    #if DEBUG
    /// In DEBUG mode, show the Screen Launcher by default for parity testing
    @State private var showScreenLauncher = true

    /// Visual test mode hides debug UI for pixel parity screenshots
    /// Set via launch argument: -VISUAL_TEST_MODE or environment variable: VISUAL_TEST_MODE=1
    private var isVisualTestMode: Bool {
        ProcessInfo.processInfo.arguments.contains("-VISUAL_TEST_MODE") ||
        ProcessInfo.processInfo.environment["VISUAL_TEST_MODE"] == "1"
    }

    /// Get the screen to auto-navigate to from launch arguments
    /// Format: -SCREEN_NAME=<screen_name>
    private var autoNavigateScreen: String? {
        for arg in ProcessInfo.processInfo.arguments {
            if arg.hasPrefix("-SCREEN_NAME=") {
                return String(arg.dropFirst("-SCREEN_NAME=".count))
            }
        }
        return ProcessInfo.processInfo.environment["SCREEN_NAME"]
    }

    /// Navigate to a specific screen by name for visual testing
    private func navigateToScreen(_ screenName: String) {
        // Special handling for screens that need sheet presentation over home
        switch screenName {
        case "paymentMethodSelectionSheet", "41-7005":
            // 41:7005 is a bottom sheet modal shown over the home screen
            // First navigate to home, then present the sheet
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                coordinator.navigate(to: .homeZeroStateFigma)
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.3) {
                    coordinator.present(sheet: .paymentMethodSelectionSheet)
                }
            }
            return
        default:
            break
        }

        let route: Route? = switch screenName {
        // Home States
        case "homeZeroState", "41-4569":
            .homeZeroStateFigma
        // Agreement
        case "agreementUpload", "1-29914":
            .agreementUpload
        // Payment
        case "paymentBreakdown", "41-9746":
            .paymentTransaction(tenancyId: "mock-tenancy-123", rentAmountPaise: 3250000)
        case "paymentMethods":
            .paymentMethods
        // Splash
        case "splash", "1-28055":
            .splash
        // Phone Entry
        case "phoneEntry", "1-28071":
            .phoneEntry(authIntent: .signup)
        // Add more screens as needed
        default:
            nil
        }

        if let route = route {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) {
                coordinator.navigate(to: route)
            }
        }
    }
    #endif

    var body: some Scene {
        WindowGroup {
            #if DEBUG
            ZStack {
                ContentView()
                    .environment(appState)
                    .environment(coordinator)
                    .task {
                        await appState.initialize()
                        // Auto-navigate to specific screen if specified in launch arguments
                        if isVisualTestMode, let screenName = autoNavigateScreen {
                            navigateToScreen(screenName)
                        }
                    }

                // Screen Launcher overlay in DEBUG mode (hidden in visual test mode)
                if showScreenLauncher && !isVisualTestMode {
                    Color.black
                        .ignoresSafeArea()
                        .contentShape(Rectangle())

                    ScreenLauncherView(isVisible: $showScreenLauncher)
                        .environment(coordinator)
                        .transition(.move(edge: .bottom))
                }
            }
            .overlay(alignment: .topTrailing) {
                // Toggle button for Screen Launcher (hidden in visual test mode)
                if !isVisualTestMode {
                    Button {
                        withAnimation {
                            showScreenLauncher.toggle()
                        }
                    } label: {
                        Image(systemName: showScreenLauncher ? "xmark.circle.fill" : "list.bullet.rectangle")
                            .font(.title2)
                            .foregroundColor(.green)
                            .padding(12)
                            .background(Circle().fill(Color.black.opacity(0.7)))
                    }
                    .padding(.top, 50)
                    .padding(.trailing, 16)
                }
            }
            #else
            ContentView()
                .environment(appState)
                .environment(coordinator)
                .task {
                    await appState.initialize()
                }
            #endif
        }
    }
}
