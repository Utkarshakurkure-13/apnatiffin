import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';

export default function StitchCarousel({ setActiveTab, onExploreClick }) {
  const totalSlides = 5;
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const autoSlideTimerRef = useRef(null);
  const touchStartXRef = useRef(0);
  const touchEndXRef = useRef(0);
  const viewportRef = useRef(null);

  // Auto-sliding loop
  useEffect(() => {
    if (isPlaying) {
      autoSlideTimerRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
      }, 3800);
    }
    return () => {
      if (autoSlideTimerRef.current) clearInterval(autoSlideTimerRef.current);
    };
  }, [isPlaying, currentSlide]);

  const restartTimer = () => {
    if (autoSlideTimerRef.current) clearInterval(autoSlideTimerRef.current);
    if (isPlaying) {
      autoSlideTimerRef.current = setInterval(() => {
        setCurrentSlide((prev) => (prev + 1) % totalSlides);
      }, 3800);
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
    restartTimer();
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
    restartTimer();
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
    restartTimer();
  };

  const togglePlayPause = () => {
    setIsPlaying((prev) => !prev);
  };

  // Touch Swipe Handling for Mobile & Tablet
  const handleTouchStart = (e) => {
    touchStartXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e) => {
    touchEndXRef.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartXRef.current || !touchEndXRef.current) return;
    const diffX = touchStartXRef.current - touchEndXRef.current;
    if (diffX > 50) {
      // Swiped left -> Next
      nextSlide();
    } else if (diffX < -50) {
      // Swiped right -> Prev
      prevSlide();
    }
    touchStartXRef.current = 0;
    touchEndXRef.current = 0;
  };

  // 3D Tilt Effect on Mouse Move
  const handleMouseMove = (e) => {
    if (!viewportRef.current) return;
    const rect = viewportRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const tiltX = (y / (rect.height / 2)) * -3.5;
    const tiltY = (x / (rect.width / 2)) * 3.5;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
    if (isPlaying) restartTimer();
  };

  const handleMouseEnter = () => {
    if (autoSlideTimerRef.current) clearInterval(autoSlideTimerRef.current);
  };

  const handleCtaClick = (action) => {
    if (action === 'points' && setActiveTab) {
      setActiveTab('customer-points');
      return;
    }
    if (action === 'subscriptions' && setActiveTab) {
      setActiveTab('customer-subscriptions');
      return;
    }
    if (onExploreClick) {
      onExploreClick();
    } else {
      const el = document.getElementById('kitchens-grid');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="w-full relative rounded-3xl overflow-hidden shadow-2xl bg-slate-950/90 border border-slate-800/90 p-2.5 sm:p-3.5 md:p-4 perspective-card">
      {/* Main Viewport */}
      <div
        ref={viewportRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="relative overflow-hidden rounded-2xl w-full min-h-[290px] sm:min-h-[320px] md:min-h-[340px] aspect-[21/10] md:aspect-[2.7/1] select-none transition-transform duration-200 ease-out"
        style={{
          transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        }}
      >
        {/* Slides Track */}
        <div
          className="flex h-full w-full transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
          {/* SLIDE 1: Earn Bonus Points */}
          <div className="min-w-full h-full relative overflow-hidden flex items-center bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 p-5 sm:p-8 md:p-12 text-white">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_50%,rgba(255,255,255,0.25),transparent_60%)]" />
            
            {/* Slide Tag */}
            <div className="absolute top-3 sm:top-4 left-4 sm:left-5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-widest text-white/90 z-20">
              1 / 5
            </div>

            <div className="relative z-10 max-w-sm sm:max-w-md md:max-w-lg space-y-2 sm:space-y-3">
              <span className="text-amber-100 font-extrabold text-xs sm:text-sm tracking-wide uppercase">
                Rewards &amp; Cashback
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black leading-tight drop-shadow-md">
                Earn <span className="text-yellow-200">Bonus Points</span> on Every Order!
              </h2>
              <p className="text-amber-100/90 text-xs sm:text-sm md:text-base font-medium">
                More Orders • More Points • More Benefits
              </p>
              <div className="pt-2">
                <button
                  onClick={() => handleCtaClick('points')}
                  className="bg-emerald-700 hover:bg-emerald-600 transition-all text-white font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-lg hover:shadow-emerald-500/40 hover:-translate-y-0.5 flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <span>Order Now</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* 3D Graphic Composition */}
            <div className="absolute right-3 sm:right-6 md:right-14 top-1/2 -translate-y-1/2 hidden sm:flex items-center justify-center">
              <div className="relative w-48 h-48 md:w-72 md:h-72 card-3d">
                <div className="absolute inset-0 bg-yellow-400/30 rounded-full blur-2xl pulse-glow-soft" />
                {/* 3D Gift Box */}
                <div className="floating-element absolute inset-4 md:inset-6 bg-gradient-to-br from-amber-400 to-orange-600 rounded-3xl shadow-2xl border-4 border-amber-200/50 flex flex-col items-center justify-center text-center p-3 md:p-4">
                  <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-yellow-300 text-amber-900 flex items-center justify-center text-2xl md:text-3xl font-black shadow-inner border-2 border-amber-500 floating-badge">
                    P
                  </div>
                  <div className="mt-2 md:mt-3 bg-white/95 text-slate-800 font-bold text-[11px] md:text-xs px-2.5 md:px-3 py-1 md:py-1.5 rounded-xl shadow-md">
                    Good Food • Happier You! ❤️
                  </div>
                </div>
                {/* Floating Coins */}
                <div className="floating-badge absolute -top-2 left-6 w-10 h-10 md:w-12 md:h-12 rounded-full bg-yellow-300 text-amber-800 font-black flex items-center justify-center text-lg md:text-xl shadow-lg border-2 border-yellow-100">
                  P
                </div>
                <div className="floating-badge absolute bottom-2 -left-2 w-11 h-11 md:w-14 md:h-14 rounded-full bg-yellow-400 text-amber-800 font-black flex items-center justify-center text-xl md:text-2xl shadow-xl border-2 border-yellow-200" style={{ animationDelay: '1s' }}>
                  P
                </div>
                <div className="floating-badge absolute -bottom-2 right-4 w-9 h-9 md:w-10 md:h-10 rounded-full bg-yellow-300 text-amber-800 font-black flex items-center justify-center text-base md:text-lg shadow-lg border-2 border-yellow-100" style={{ animationDelay: '1.5s' }}>
                  P
                </div>
              </div>
            </div>
          </div>

          {/* SLIDE 2: Homemade Food */}
          <div className="min-w-full h-full relative overflow-hidden flex items-center bg-gradient-to-r from-amber-100 via-orange-50 to-stone-100 p-5 sm:p-8 md:p-12 text-slate-900">
            {/* Slide Tag */}
            <div className="absolute top-3 sm:top-4 left-4 sm:left-5 bg-slate-900/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-widest text-white z-20">
              2 / 5
            </div>

            <div className="relative z-10 max-w-sm sm:max-w-md md:max-w-lg space-y-2 sm:space-y-3">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-emerald-700 leading-tight">
                Homemade Food, <span className="text-red-500">❤️</span>
              </h2>
              <p className="text-base sm:text-lg md:text-xl font-bold text-slate-700">
                Delivered to Your Doorstep
              </p>
              <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-semibold text-slate-600">
                <span>🌱 Fresh</span>
                <span>•</span>
                <span>❤️ Healthy</span>
                <span>•</span>
                <span>🍴 Delicious</span>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => handleCtaClick('explore')}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-lg hover:shadow-emerald-600/30 flex items-center gap-2 text-xs sm:text-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Taste the Difference</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* 3D Chef & Thali Visual */}
            <div className="absolute right-4 sm:right-6 md:right-16 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-4">
              <div className="relative w-44 md:w-60 h-44 md:h-60 flex items-center justify-center floating-element">
                {/* Chalkboard badge */}
                <div className="absolute -top-3 -right-2 bg-stone-900 text-amber-200 border-2 border-amber-800 px-3 py-1.5 rounded-lg text-[11px] md:text-xs font-serif text-center shadow-lg rotate-6 z-20">
                  Ghar ka Khana<br /><span className="text-amber-400 font-bold">Sabse Best ❤️</span>
                </div>
                {/* Thali 3D Illustration Stand-in */}
                <div className="w-40 md:w-52 h-40 md:h-52 rounded-full bg-gradient-to-tr from-amber-300 via-orange-400 to-amber-200 p-2 shadow-2xl border-4 border-white flex items-center justify-center">
                  <div className="w-full h-full rounded-full bg-amber-950/20 backdrop-blur-sm border-2 border-dashed border-white/60 flex flex-col items-center justify-center text-white text-center p-2.5">
                    <span className="text-3xl md:text-4xl">🍲</span>
                    <span className="text-[11px] md:text-xs font-bold uppercase tracking-wider mt-1 text-amber-100">
                      Hot Tiffin Thali
                    </span>
                    <span className="text-[10px] md:text-[11px] bg-red-500/90 text-white font-semibold px-2 py-0.5 rounded-full mt-1">
                      Made with Love ❤️
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SLIDE 3: Enjoy Free Delivery */}
          <div className="min-w-full h-full relative overflow-hidden flex items-center bg-gradient-to-r from-sky-400 via-cyan-500 to-blue-600 p-5 sm:p-8 md:p-12 text-white">
            {/* Slide Tag */}
            <div className="absolute top-3 sm:top-4 left-4 sm:left-5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-widest text-white z-20">
              3 / 5
            </div>

            <div className="relative z-10 max-w-sm sm:max-w-md md:max-w-lg space-y-2 sm:space-y-3">
              <span className="text-sky-100 font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                Fast &amp; Free
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black leading-tight text-white drop-shadow">
                Enjoy <span className="text-amber-300 underline decoration-wavy decoration-amber-400">Free Delivery!</span>
              </h2>
              <p className="text-sky-100 text-xs sm:text-sm md:text-base font-medium">
                Get your favourite tiffin delivered conveniently to your doorstep on time, every day.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => handleCtaClick('explore')}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-lg hover:shadow-emerald-500/40 flex items-center gap-2 text-xs sm:text-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Order Now</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* Scooter Delivery 3D Graphic */}
            <div className="absolute right-4 sm:right-8 md:right-16 top-1/2 -translate-y-1/2 hidden sm:flex">
              <div className="relative w-48 md:w-64 h-48 md:h-64 flex items-center justify-center">
                {/* Delivery Bag / Tag */}
                <div className="floating-badge absolute -top-3 -left-3 bg-white text-slate-800 px-3 py-1.5 rounded-2xl shadow-xl font-bold text-[11px] md:text-xs border border-sky-100 text-center z-20">
                  No Extra<br /><span className="text-emerald-600 font-extrabold">Delivery Charges ❤️</span>
                </div>
                {/* 3D Scooter element */}
                <div className="floating-element w-44 md:w-56 h-36 md:h-44 bg-gradient-to-br from-emerald-400 to-teal-700 rounded-3xl shadow-2xl p-3 md:p-4 flex flex-col justify-between border-4 border-white/40 text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-2xl md:text-3xl">🛵</span>
                    <span className="text-[10px] md:text-xs font-black bg-white/20 px-2 py-0.5 rounded-md">
                      Good Food Happy You ❤️
                    </span>
                  </div>
                  <div className="text-center font-black text-base md:text-lg tracking-tight">
                    Super Fast Delivery
                  </div>
                  <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-amber-300 h-full w-4/5 animate-pulse" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SLIDE 4: Discover Local Providers */}
          <div className="min-w-full h-full relative overflow-hidden flex items-center bg-gradient-to-r from-amber-100 via-orange-100 to-yellow-50 p-5 sm:p-8 md:p-12 text-slate-900">
            {/* Slide Tag */}
            <div className="absolute top-3 sm:top-4 left-4 sm:left-5 bg-slate-900/60 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-widest text-white z-20">
              4 / 5
            </div>

            <div className="relative z-10 max-w-sm sm:max-w-md md:max-w-lg space-y-2 sm:space-y-3">
              <span className="text-amber-800 font-extrabold text-xs sm:text-sm uppercase tracking-wider">
                Community Kitchens
              </span>
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black text-amber-900 leading-tight">
                Discover <span className="text-orange-600">Local Tiffin Providers</span>
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm md:text-base font-medium">
                Choose from trusted local home chefs and providers to find the meal plan that suits your taste.
              </p>
              <div className="pt-2">
                <button
                  onClick={() => handleCtaClick('explore')}
                  className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-lg hover:shadow-emerald-600/30 flex items-center gap-2 text-xs sm:text-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>Explore Providers</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* 3D Chef & Badge Graphic */}
            <div className="absolute right-4 sm:right-8 md:right-16 top-1/2 -translate-y-1/2 hidden sm:flex">
              <div className="relative w-48 md:w-64 h-48 md:h-64 flex items-center justify-center">
                <div className="floating-badge absolute -top-2 -right-2 bg-amber-50 border-2 border-amber-300 shadow-xl px-3 py-1.5 rounded-xl text-center z-20 text-[11px] md:text-xs font-bold text-amber-950">
                  Support Local<br /><span className="text-red-500">Homemade ❤️</span>
                </div>
                {/* 3D Kitchen Card */}
                <div className="floating-element w-44 md:w-56 h-44 md:h-56 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-3 md:p-4 text-white shadow-2xl border-4 border-white flex flex-col justify-between items-center text-center">
                  <span className="text-3xl md:text-4xl">👩‍🍳</span>
                  <div>
                    <h3 className="font-extrabold text-sm md:text-base">Local Food</h3>
                    <p className="text-[11px] text-amber-100">Stronger Communities ❤️</p>
                  </div>
                  <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] md:text-xs font-medium">
                    Verified Home Chefs
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SLIDE 5: Your Meal, Your Plan */}
          <div className="min-w-full h-full relative overflow-hidden flex items-center bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-800 p-5 sm:p-8 md:p-12 text-white">
            {/* Slide Tag */}
            <div className="absolute top-3 sm:top-4 left-4 sm:left-5 bg-black/40 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold tracking-widest text-white z-20">
              5 / 5
            </div>

            <div className="relative z-10 max-w-sm sm:max-w-md md:max-w-lg space-y-2 sm:space-y-3">
              <h2 className="text-2xl sm:text-3xl md:text-5xl font-black leading-tight text-white drop-shadow">
                Your Meal, <span className="text-amber-300">Your Plan</span>
              </h2>
              <p className="text-indigo-100 text-xs sm:text-sm md:text-base font-medium">
                Choose Lunch, Dinner or both — with flexible subscription plans that fit your routine.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs sm:text-sm font-semibold">
                <span className="bg-white/20 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">✓ 7 Days</span>
                <span className="bg-white/20 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">✓ 15 Days</span>
                <span className="bg-emerald-500/80 px-2.5 sm:px-3 py-0.5 sm:py-1 rounded-full">✓ Monthly</span>
              </div>
              <div className="pt-2">
                <button
                  onClick={() => handleCtaClick('subscriptions')}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 sm:px-6 py-2 sm:py-2.5 rounded-full shadow-lg hover:shadow-emerald-500/30 flex items-center gap-2 text-xs sm:text-sm transition-all hover:-translate-y-0.5 cursor-pointer"
                >
                  <span>View Meal Plans</span>
                  <span>→</span>
                </button>
              </div>
            </div>

            {/* Calendar & Tiffin 3D Element */}
            <div className="absolute right-4 sm:right-8 md:right-16 top-1/2 -translate-y-1/2 hidden sm:flex">
              <div className="relative w-48 md:w-64 h-48 md:h-64 flex items-center justify-center">
                <div className="floating-badge absolute -top-3 -right-2 bg-yellow-300 text-slate-900 px-3 py-1.5 rounded-xl font-bold text-[11px] md:text-xs shadow-lg text-center z-20">
                  Healthy Meals<br /><span className="text-red-600">Happier Days ❤️</span>
                </div>
                {/* 3D Subscription Plan Card */}
                <div className="floating-element w-44 md:w-56 h-40 md:h-48 bg-white text-slate-800 rounded-2xl shadow-2xl p-3 md:p-4 flex flex-col justify-between border-4 border-purple-200">
                  <div className="flex items-center justify-between border-b border-purple-100 pb-1.5">
                    <span className="font-extrabold text-xs md:text-sm text-purple-900">Subscription Box</span>
                    <span className="text-[10px] md:text-xs bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-bold">
                      Lunch + Dinner
                    </span>
                  </div>
                  <div className="text-center py-1">
                    <div className="text-2xl md:text-3xl">🍱</div>
                    <div className="text-[10px] md:text-xs font-bold text-slate-500 mt-0.5">
                      Stainless Steel Tiffin Set
                    </div>
                  </div>
                  <div className="text-center text-[10px] md:text-xs font-bold text-emerald-600 bg-emerald-50 py-1 rounded-md">
                    Flexible Skip &amp; Pause Anytime
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Carousel Controls & Pagination Indicators Bar */}
      <div className="flex items-center justify-between mt-3 px-1 sm:px-2">
        {/* Navigation Arrows */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={prevSlide}
            title="Previous Banner"
            aria-label="Previous Slide"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border border-slate-700 transition active:scale-95 shadow cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={nextSlide}
            title="Next Banner"
            aria-label="Next Slide"
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border border-slate-700 transition active:scale-95 shadow cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Pagination Indicators (Dots / Active Pill) */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              aria-label={`Go to slide ${index + 1}`}
              className={`rounded-full transition-all duration-300 cursor-pointer ${
                index === currentSlide
                  ? 'w-7 sm:w-8 h-2.5 sm:h-3 bg-emerald-500 shadow-xs'
                  : 'w-2.5 sm:w-3 h-2.5 sm:h-3 bg-slate-700 hover:bg-slate-600'
              }`}
            />
          ))}
        </div>

        {/* Play / Pause Toggle Button */}
        <div className="flex items-center">
          <button
            onClick={togglePlayPause}
            title={isPlaying ? 'Pause Auto-Sliding' : 'Play Auto-Sliding'}
            aria-label={isPlaying ? 'Pause Carousel' : 'Play Carousel'}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border border-slate-700 transition active:scale-95 shadow cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5 text-emerald-400" /> : <Play className="w-3.5 h-3.5 text-amber-400" />}
          </button>
        </div>
      </div>
    </div>
  );
}
