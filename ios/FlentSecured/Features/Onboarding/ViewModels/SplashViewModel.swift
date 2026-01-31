/// SplashViewModel.swift
/// Flent Secured v2 - Splash Screen ViewModel
///
/// Manages splash screen state including:
/// - Carousel mode navigation
/// - UserDefaults persistence for hasSeenIntro

import SwiftUI
import Observation

// MARK: - Splash View Model

@Observable
final class SplashViewModel {

    // MARK: - Types

    /// Splash screen display mode
    enum Mode: Equatable {
        case introAnimation
        case carousel
    }

    // MARK: - Published State

    /// Current display mode
    var mode: Mode = .carousel

    /// Current carousel slide index
    var slideIndex: Int = 0

    /// Intro animation progress (0.0 to 1.0)
    var introProgress: CGFloat = 0

    /// Whether intro has completed or been skipped
    var introCompleted: Bool = true

    // MARK: - Constants

    /// UserDefaults key for tracking first launch
    private let hasSeenIntroKey = "hasSeenSplashIntroAnimation"

    /// Maximum duration for intro animation (seconds)
    let introAnimationDuration: TimeInterval = 3.0

    /// Auto-scroll interval for carousel (seconds)
    let autoScrollInterval: TimeInterval = 4.0

    /// Slide animation duration (seconds)
    let slideAnimationDuration: TimeInterval = 0.5

    /// Page indicator animation duration (seconds)
    let indicatorAnimationDuration: TimeInterval = 0.3

    // MARK: - Computed Properties

    /// Whether user has previously seen the intro animation
    var hasSeenIntro: Bool {
        UserDefaults.standard.bool(forKey: hasSeenIntroKey)
    }

    /// Number of carousel slides
    let slideCount: Int = 4

    // MARK: - Initialization

    init() {
        mode = .carousel
        introCompleted = true
    }

    // MARK: - Actions

    /// Mark intro animation as seen in UserDefaults
    func markIntroSeen() {
        UserDefaults.standard.set(true, forKey: hasSeenIntroKey)
    }

    /// Skip intro animation and transition to carousel
    func skipIntro() {
        withAnimation(.easeInOut(duration: 0.3)) {
            mode = .carousel
            introCompleted = true
        }
        markIntroSeen()
        trackAnalyticsEvent(.introSkipped)
    }

    /// Complete intro animation and transition to carousel
    func completeIntro() {
        guard !introCompleted else { return }

        withAnimation(.easeInOut(duration: slideAnimationDuration)) {
            mode = .carousel
            introCompleted = true
        }
        markIntroSeen()
        trackAnalyticsEvent(.introCompleted)
    }

    /// Go to specific slide index
    func goToSlide(_ index: Int) {
        guard index >= 0 && index < slideCount && index != slideIndex else { return }

        withAnimation(.easeInOut(duration: slideAnimationDuration)) {
            slideIndex = index
        }
    }

    /// Advance to next slide (wraps around)
    func nextSlide() {
        let nextIndex = (slideIndex + 1) % slideCount
        goToSlide(nextIndex)
    }

    /// Go to previous slide (wraps around)
    func previousSlide() {
        let prevIndex = (slideIndex - 1 + slideCount) % slideCount
        goToSlide(prevIndex)
    }

    /// Handle swipe gesture
    func handleSwipe(_ translation: CGFloat, threshold: CGFloat = 50) {
        if translation < -threshold {
            nextSlide()
        } else if translation > threshold {
            previousSlide()
        }
    }

    // MARK: - Analytics (Stub)

    enum AnalyticsEvent {
        case splashViewed
        case introSkipped
        case introCompleted
        case getStartedTapped
        case loginTapped
        case carouselSlideViewed(index: Int)
    }

    /// Track analytics event (stub for future implementation)
    func trackAnalyticsEvent(_ event: AnalyticsEvent) {
        switch event {
        case .splashViewed:
            print("[Analytics] Splash screen viewed")
        case .introSkipped:
            print("[Analytics] Intro animation skipped")
        case .introCompleted:
            print("[Analytics] Intro animation completed")
        case .getStartedTapped:
            print("[Analytics] Get Started button tapped")
        case .loginTapped:
            print("[Analytics] Login link tapped")
        case .carouselSlideViewed(let index):
            print("[Analytics] Carousel slide \(index) viewed")
        }
    }

    // MARK: - Reset (for testing)

    /// Reset the hasSeenIntro flag (for testing)
    func resetIntroState() {
        UserDefaults.standard.removeObject(forKey: hasSeenIntroKey)
        mode = .introAnimation
        introCompleted = false
        slideIndex = 0
    }
}
