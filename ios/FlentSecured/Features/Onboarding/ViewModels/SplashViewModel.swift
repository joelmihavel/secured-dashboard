/// SplashViewModel.swift
/// Flent Secured v2 - Splash Screen ViewModel
///
/// Manages splash screen state including:
/// - Intro animation mode (first cold launch only)
/// - Carousel mode (subsequent launches)
/// - Video background playback
/// - UserDefaults persistence for hasSeenIntro
/// - Environment checks for video fallback

import SwiftUI
import AVFoundation
import Observation
#if canImport(UIKit)
import UIKit
#endif

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
    var mode: Mode = .introAnimation

    /// Current carousel slide index
    var slideIndex: Int = 0

    /// Whether the video player is ready
    var isVideoReady: Bool = false

    /// Whether video failed to load
    var videoLoadFailed: Bool = false

    /// Intro animation progress (0.0 to 1.0)
    var introProgress: CGFloat = 0

    /// Whether intro has completed or been skipped
    var introCompleted: Bool = false

    // MARK: - Constants

    /// UserDefaults key for tracking first launch
    private let hasSeenIntroKey = "hasSeenSplashIntroAnimation"

    /// Maximum duration for intro animation (seconds)
    let introAnimationDuration: TimeInterval = 3.0

    /// Video load timeout (milliseconds)
    let videoLoadTimeout: Int = 250

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

    /// Whether video background should be shown
    /// Returns false if: Reduce Motion ON, Low Power Mode ON, Thermal critical, or video failed
    var shouldShowVideo: Bool {
        // Check Reduce Motion accessibility setting
        if UIAccessibility.isReduceMotionEnabled {
            return false
        }

        // Check Low Power Mode
        if ProcessInfo.processInfo.isLowPowerModeEnabled {
            return false
        }

        // Check thermal state
        if ProcessInfo.processInfo.thermalState == .critical ||
           ProcessInfo.processInfo.thermalState == .serious {
            return false
        }

        // Check if video load failed
        if videoLoadFailed {
            return false
        }

        return true
    }

    /// Number of carousel slides
    let slideCount: Int = 4

    // MARK: - Initialization

    init() {
        // Always start in carousel mode (video animation disabled)
        // Video file not yet added to bundle - skip intro animation
        mode = .carousel
        introCompleted = true
        videoLoadFailed = true // Prevent video player initialization
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

        // Analytics stub
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

        // Analytics stub
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

    /// Mark video as ready
    func videoDidBecomeReady() {
        isVideoReady = true
    }

    /// Mark video as failed to load
    func videoDidFail() {
        videoLoadFailed = true
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
        // TODO: Implement analytics tracking
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

// MARK: - Video Player Manager

/// Manages AVPlayer for splash video background
final class SplashVideoPlayer: NSObject, ObservableObject {

    // MARK: - Published State

    @Published var player: AVPlayer?
    @Published var isReady: Bool = false
    @Published var didFail: Bool = false

    // MARK: - Private Properties

    private var playerLooper: AVPlayerLooper?
    private var queuePlayer: AVQueuePlayer?
    private var timeoutWorkItem: DispatchWorkItem?
    private var statusObservation: NSKeyValueObservation?

    // MARK: - Initialization

    override init() {
        super.init()
    }

    deinit {
        cleanup()
    }

    // MARK: - Setup

    /// Load and prepare the video player
    func setup(timeoutMs: Int = 250) {
        // Try to load video from bundle
        guard let videoURL = Bundle.main.url(forResource: "splash_background", withExtension: "mp4") else {
            print("[SplashVideoPlayer] Video file not found in bundle")
            didFail = true
            return
        }

        // Create player item
        let playerItem = AVPlayerItem(url: videoURL)

        // Create queue player for looping
        let queuePlayer = AVQueuePlayer(playerItem: playerItem)
        self.queuePlayer = queuePlayer

        // Create looper for seamless looping
        playerLooper = AVPlayerLooper(player: queuePlayer, templateItem: playerItem)

        // Set player
        player = queuePlayer

        // Configure for background audio (muted video)
        queuePlayer.isMuted = true

        // Set timeout for video load
        let timeout = DispatchWorkItem { [weak self] in
            if self?.isReady != true {
                print("[SplashVideoPlayer] Video load timeout")
                self?.didFail = true
            }
        }
        timeoutWorkItem = timeout
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs), execute: timeout)

        // Observe player item status
        statusObservation = playerItem.observe(\.status, options: [.new]) { [weak self] item, _ in
            DispatchQueue.main.async {
                switch item.status {
                case .readyToPlay:
                    self?.timeoutWorkItem?.cancel()
                    self?.isReady = true
                    print("[SplashVideoPlayer] Video ready to play")
                case .failed:
                    self?.timeoutWorkItem?.cancel()
                    self?.didFail = true
                    print("[SplashVideoPlayer] Video failed to load: \(item.error?.localizedDescription ?? "unknown")")
                case .unknown:
                    break
                @unknown default:
                    break
                }
            }
        }

        // Listen for app lifecycle
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appWillEnterForeground),
            name: UIApplication.willEnterForegroundNotification,
            object: nil
        )
    }

    // MARK: - Playback Control

    /// Start video playback
    func play() {
        queuePlayer?.play()
    }

    /// Pause video playback
    func pause() {
        queuePlayer?.pause()
    }

    /// Cleanup resources
    func cleanup() {
        timeoutWorkItem?.cancel()
        statusObservation?.invalidate()
        queuePlayer?.pause()
        playerLooper?.disableLooping()
        playerLooper = nil
        queuePlayer = nil
        player = nil

        NotificationCenter.default.removeObserver(self)
    }

    // MARK: - App Lifecycle

    @objc private func appDidEnterBackground() {
        pause()
    }

    @objc private func appWillEnterForeground() {
        if isReady && !didFail {
            play()
        }
    }
}
