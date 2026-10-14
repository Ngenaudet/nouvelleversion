(function(){
  "use strict";
  var hasGsap = typeof window.gsap !== "undefined";
  var $ = function(s,c){return (c||document).querySelector(s)};
  var $$ = function(s,c){return Array.prototype.slice.call((c||document).querySelectorAll(s))};

  /* ---------- Split texte (mots / lettres), accessible ---------- */
  function split(el, mode){
    var text = el.textContent.trim().replace(/\s+/g," ");
    el.setAttribute("aria-label", text);
    el.textContent = "";
    var words = text.split(" ");
    words.forEach(function(word, i){
      var w = document.createElement("span"); w.className = "w"; w.setAttribute("aria-hidden","true");
      var wi = document.createElement("span"); wi.className = "wi";
      if(mode === "chars"){
        Array.from(word).forEach(function(c){var ch=document.createElement("span");ch.className="ch";ch.textContent=c;wi.appendChild(ch);});
      } else { wi.textContent = word; }
      w.appendChild(wi); el.appendChild(w);
      if(i < words.length-1) el.appendChild(document.createTextNode(" "));
    });
    return mode === "chars" ? $$(".ch", el) : $$(".wi", el);
  }
  $$("[data-split]").forEach(function(el){ el._parts = split(el, el.dataset.split); });
  var scrub = $("[data-scrub]"); if(scrub) scrub._parts = split(scrub,"words");

  /* ---------- Storytelling : remplissage blanc piloté directement par le scroll ---------- */
  if(scrub){
    var storyMotion = window.matchMedia("(prefers-reduced-motion:reduce)"), storyFrame = null;
    function paintStory(){
      storyFrame = null;
      scrub.classList.toggle("is-scroll-filled", !storyMotion.matches);
      if(storyMotion.matches) return;
      var bounds = scrub.getBoundingClientRect(), viewport = window.innerHeight;
      var progress = Math.max(0, Math.min(1, (viewport*.8-bounds.top)/(bounds.height+viewport*.35)));
      scrub._parts.forEach(function(word,i){
        var fill = Math.max(0, Math.min(1, progress*scrub._parts.length-i));
        word.style.setProperty("--word-fill", (fill*100).toFixed(2)+"%");
      });
    }
    function updateStory(){
      if(storyFrame === null) storyFrame = window.requestAnimationFrame(paintStory);
    }
    window.addEventListener("scroll",updateStory,{passive:true});
    window.addEventListener("resize",updateStory);
    window.addEventListener("load",updateStory);
    storyMotion.addEventListener("change",updateStory);
    new ResizeObserver(updateStory).observe(scrub);
    document.fonts.ready.then(updateStory);
    paintStory();
  }

  /* ---------- FAQ (fonctionne toujours) ---------- */
  $$(".faq-q").forEach(function(btn){
    btn.addEventListener("click", function(){
      var item = btn.closest(".faq-item"), panel = item.querySelector(".faq-a"), open = item.classList.contains("is-open");
      $$(".faq-item.is-open").forEach(function(other){
        if(other === item) return;
        other.classList.remove("is-open"); other.querySelector(".faq-q").setAttribute("aria-expanded","false");
        var p = other.querySelector(".faq-a");
        if(hasGsap) gsap.to(p,{height:0,duration:.293,ease:"power3.inOut"}); else p.style.height="0";
      });
      item.classList.toggle("is-open", !open); btn.setAttribute("aria-expanded", String(!open));
      if(hasGsap){
        if(open) gsap.to(panel,{height:0,duration:.293,ease:"power3.inOut"});
        else { gsap.fromTo(panel,{height:0},{height:"auto",duration:.358,ease:"power3.out"}); gsap.from(panel.querySelector("p"),{y:12,opacity:0,duration:.325,delay:.1}); }
      } else panel.style.height = open ? "0" : "auto";
    });
  });

  /* ---------- Slider des offres : swipe, boutons et clavier ---------- */
  var offersTrack = $("#offers-track"), offerCards = $$(".offer", offersTrack);
  var offersControls = $(".offers-controls"), offerPrev = $("[data-offer-prev]"), offerNext = $("[data-offer-next]");
  var sliderMedia = window.matchMedia("(min-width:601px) and (max-width:1024px)"), currentOffer = 0;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion:reduce)");
  function updateOffers(){
    var left = offersTrack.getBoundingClientRect().left + (parseFloat(window.getComputedStyle(offersTrack).paddingLeft) || 0);
    if(offersTrack.scrollLeft >= offersTrack.scrollWidth-offersTrack.clientWidth-2 && offersTrack.scrollLeft > 0){
      currentOffer = offerCards.length-1;
    } else {
      currentOffer = offerCards.reduce(function(best, card, i){
        return Math.abs(card.getBoundingClientRect().left-left) < Math.abs(offerCards[best].getBoundingClientRect().left-left) ? i : best;
      }, 0);
    }
    $(".offers-position").textContent = (currentOffer+1) + " / " + offerCards.length;
    offerPrev.disabled = currentOffer === 0;
    offerNext.disabled = currentOffer === offerCards.length-1;
  }
  function moveOffer(index){
    index = Math.max(0, Math.min(offerCards.length-1,index));
    var offset = offerCards[index].getBoundingClientRect().left - offersTrack.getBoundingClientRect().left - (parseFloat(window.getComputedStyle(offersTrack).paddingLeft) || 0);
    offersTrack.scrollTo({left:offersTrack.scrollLeft+offset,behavior:reducedMotion.matches ? "instant" : "smooth"});
  }
  function setSlider(){
    offersControls.hidden = !sliderMedia.matches;
    offersTrack.tabIndex = sliderMedia.matches ? 0 : -1;
    if(!sliderMedia.matches) offersTrack.scrollLeft = 0;
    updateOffers();
  }
  offerPrev.addEventListener("click",function(){moveOffer(currentOffer-1);});
  offerNext.addEventListener("click",function(){moveOffer(currentOffer+1);});
  offersTrack.addEventListener("scroll",updateOffers,{passive:true});
  offersTrack.addEventListener("keydown",function(e){
    if(!sliderMedia.matches || e.target !== offersTrack) return;
    var index;
    if(e.key === "ArrowRight") index = currentOffer+1;
    else if(e.key === "ArrowLeft") index = currentOffer-1;
    else if(e.key === "Home") index = 0;
    else if(e.key === "End") index = offerCards.length-1;
    else return;
    e.preventDefault(); moveOffer(index);
  });
  sliderMedia.addEventListener("change",setSlider);
  new ResizeObserver(updateOffers).observe(offersTrack);
  setSlider();

  /* ---------- Menu mobile ---------- */
  var burgers = $$(".burger"), menu = $("#mobile-menu"), menuTl = null;
  function setMenu(open){
    document.body.classList.toggle("menu-open", open);
    burgers.forEach(function(b){ b.setAttribute("aria-expanded", String(open)); b.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu"); });
    menu.setAttribute("aria-hidden", String(!open));
    if(!hasGsap || reducedMotion.matches){ menu.style.visibility = open?"visible":"hidden"; menu.style.clipPath = open?"none":""; return; }
    if(!menuTl){
      menuTl = gsap.timeline({paused:true})
        .set(menu,{visibility:"visible"})
        .to(menu,{clipPath:"circle(150% at calc(100% - 40px) 40px)",duration:.52,ease:"power3.inOut"})
        .from($$(".mm-link",menu),{y:60,opacity:0,stagger:.07,duration:.39,ease:"expo.out"},"-=.35")
        .from($$(".mm-contact > *",menu),{y:20,opacity:0,stagger:.06,duration:.26},"-=.3");
    }
    open ? menuTl.timeScale(1).play() : menuTl.timeScale(1.6).reverse();
  }
  burgers.forEach(function(b){ b.addEventListener("click", function(){ setMenu(!document.body.classList.contains("menu-open")); }); });
  $$("a",menu).forEach(function(a){ a.addEventListener("click", function(){ setMenu(false); }); });

  /* ---------- Barre compacte : visible quand on remonte, après le hero ---------- */
  var mini = $("#mini-bar"), lastY = window.scrollY;
  function setMini(show){
    mini.classList.toggle("is-visible", show);
    $$("a,button", mini).forEach(function(el){ el.tabIndex = show ? 0 : -1; });
  }
  setMini(false);
  window.addEventListener("scroll", function(){
    var y = window.scrollY, up = y < lastY; lastY = y;
    if(document.body.classList.contains("menu-open")) return;
    setMini(y > 700 && up);
  }, {passive:true});

  if(!hasGsap) return;
  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ignoreMobileResize:true});

  /* ---------- Barre de progression ---------- */
  gsap.to(".progress",{scaleX:1,ease:"none",scrollTrigger:{start:0,end:"max",scrub:.3}});

  /* ---------- Lien actif dans les menus ---------- */
  var navLinks = $$(".nav-pill a");
  function setActive(target){ navLinks.forEach(function(a){ a.classList.toggle("is-active", a.dataset.target === target); }); }
  setActive("solutions");
  ["solutions","methode","apropos"].forEach(function(id){
    var sec = document.getElementById(id); if(!sec) return;
    ScrollTrigger.create({trigger:sec,start:"top 55%",end:"bottom 55%",onToggle:function(st){ if(st.isActive) setActive(id); }});
  });

  var mm = gsap.matchMedia();
  mm.add({motion:"(prefers-reduced-motion: no-preference)", fine:"(pointer: fine)"}, function(ctx){
    if(!ctx.conditions.motion) return;
    var fine = ctx.conditions.fine;

    /* ===== Intro hero ===== */
    var heroTitle = $(".hero-title");
    var intro = gsap.timeline({defaults:{ease:"expo.out"}});
    intro.from("#header .logo",{yPercent:-110,duration:.65})
      .from("#header .nav-pill",{y:-30,opacity:0,duration:.52},"-=.7")
      .from("#header .nav-pill a",{y:12,opacity:0,stagger:.06,duration:.325},"-=.5")
      .from("#header .hdr-right > *",{x:50,opacity:0,stagger:.05,duration:.52},"-=.7")
      .from(".hero .eyebrow",{y:20,opacity:0,duration:.455},"-=.6")
      .from(heroTitle._parts,{yPercent:115,rotate:6,duration:.715,stagger:.07},"-=.5")
      .fromTo(".hero .squiggle .draw",{strokeDasharray:200,strokeDashoffset:200},{strokeDashoffset:0,duration:.65,ease:"power2.inOut"},"-=.7")
      .from(".stat",{y:30,opacity:0,stagger:.06,duration:.52},"-=.7")
      .from(".avatar",{scale:0,x:-30,stagger:.06,duration:.455,ease:"back.out(2)"},"-=.6")
      .from(".collab > div:last-child, .hero-lead",{x:30,opacity:0,stagger:.06,duration:.455},"-=.4")
      .from(".offer",{y:50,opacity:0,stagger:.05,duration:.423},"-=.6")
      .from(".glyph",{yPercent:35,scale:1.25,opacity:0,stagger:.064,duration:.91,ease:"expo.out"},"-=1.1")
      .from(".offer-panel",{yPercent:12,opacity:0,stagger:.064,duration:.65,ease:"expo.out"},"-=1.3")
      .from(".offer-list li",{x:-14,opacity:0,stagger:.02,duration:.26},"-=.8");

    /* Compteurs */
    $$(".count").forEach(function(el,i){
      var end = +el.dataset.count, o = {v:0};
      gsap.to(o,{v:end,duration:2,delay:1.1+i*.15,ease:"power2.out",onUpdate:function(){el.textContent=Math.round(o.v)}});
    });

    /* Ambiance : blobs + flottement des N */
    gsap.to(".blob--1",{x:-60,y:-50,duration:9,repeat:-1,yoyo:true,ease:"sine.inOut"});
    gsap.to(".blob--2",{x:90,y:-40,duration:11,repeat:-1,yoyo:true,ease:"sine.inOut"});
    $$(".glyph-wrap").forEach(function(g,i){ gsap.to(g,{y:-10,duration:2.6+i*.3,repeat:-1,yoyo:true,ease:"sine.inOut",delay:i*.4}); gsap.to(g,{rotate:i%2?1.5:-1.5,duration:3.4+i*.4,repeat:-1,yoyo:true,ease:"sine.inOut"}); });

    /* Parallaxe hero au scroll */
    gsap.to(".hero-main",{yPercent:-12,opacity:.5,ease:"none",scrollTrigger:{trigger:".hero",start:"top top",end:"40% top",scrub:true}});
    gsap.to(".hero-aside",{yPercent:-20,ease:"none",scrollTrigger:{trigger:".hero",start:"top top",end:"40% top",scrub:true}});

    /* Ambiance du hero : les offres restent stables */
    if(fine){
      var hero = $(".hero");
      hero.addEventListener("pointermove",function(e){
        var px = e.clientX/innerWidth-.5, py = e.clientY/innerHeight-.5;
        gsap.to(".blob--1",{xPercent:px*40,yPercent:py*40,duration:.91,overwrite:"auto"});
        gsap.to(".avatars",{x:px*14,y:py*10,duration:.65});
      });
    }

    /* ===== Marquees avec accélération selon la vitesse de scroll ===== */
    $$(".marquee").forEach(function(m){
      var track = $(".marquee-track",m), right = m.dataset.dir === "right";
      var tw = gsap.fromTo(track,{xPercent:right?-50:0},{xPercent:right?0:-50,duration:right?34:30,ease:"none",repeat:-1});
      gsap.from(m,{xPercent:right?-20:20,opacity:0,duration:.78,ease:"expo.out",scrollTrigger:{trigger:m,start:"top 95%"}});
      ScrollTrigger.create({trigger:m,start:"top bottom",end:"bottom top",onUpdate:function(self){
        var boost = 1 + Math.min(Math.abs(self.getVelocity())/350, 6);
        gsap.to(tw,{timeScale:boost,duration:.2,overwrite:true,onComplete:function(){ gsap.to(tw,{timeScale:1,duration:.78,ease:"power2.out"}); }});
      }});
      gsap.to(m,{rotate:right?-.6:.7,ease:"none",scrollTrigger:{trigger:m,start:"top bottom",end:"bottom top",scrub:true}});
    });

    /* ===== Titres en lettres ===== */
    $$("[data-split='chars']").forEach(function(h){
      if(h.closest(".member") || h.closest(".method")) return;
      gsap.from(h._parts,{yPercent:120,rotate:12,opacity:0,stagger:.025,duration:.585,ease:"expo.out",scrollTrigger:{trigger:h,start:"top 85%"}});
    });
    $$(".section .eyebrow, .faq .eyebrow, .about .eyebrow").forEach(function(e){
      if(e.closest(".method")) return;
      gsap.from(e,{y:16,opacity:0,scale:.9,duration:.455,ease:"back.out(2)",scrollTrigger:{trigger:e,start:"top 90%"}});
    });
    $$(".reveal").forEach(function(r){
      if(r.closest(".method")) return;
      gsap.from(r,{y:30,opacity:0,duration:.585,ease:"power3.out",scrollTrigger:{trigger:r,start:"top 88%"}});
    });

    /* Fusée */
    var rocketTl = gsap.timeline({repeat:-1,yoyo:true});
    rocketTl.to(".rocket",{x:6,y:-8,rotate:-4,duration:.91,ease:"sine.inOut"});
    gsap.to(".flame",{scale:1.25,transformOrigin:"100% 0%",opacity:.6,duration:.18,repeat:-1,yoyo:true,ease:"none"});
    $$(".star").forEach(function(s,i){ gsap.to(s,{opacity:.2,scale:.6,duration:.52+i*.2,repeat:-1,yoyo:true,ease:"sine.inOut"}); });
    gsap.from(".rocket",{x:-120,y:120,opacity:0,duration:.91,ease:"expo.out",scrollTrigger:{trigger:".sub--launch",start:"top 85%"}});

    /* ===== CTA : ouverture en clip-path ===== */
    gsap.fromTo(".cta",{clipPath:"inset(12% 14% 12% 14% round 60px)"},{clipPath:"inset(0% 0% 0% 0% round 28px)",ease:"none",scrollTrigger:{trigger:".cta",start:"top 92%",end:"top 45%",scrub:true}});
    gsap.from($("#cta-title")._parts,{yPercent:110,stagger:.06,duration:.65,ease:"expo.out",scrollTrigger:{trigger:".cta",start:"top 70%"}});

    /* ===== Équipe ===== */
    $$(".member").forEach(function(m,i){
      var tl = gsap.timeline({scrollTrigger:{trigger:m,start:"top 75%"}});
      tl.from($(".q-ico",m),{scale:0,rotate:-180,duration:.455,ease:"back.out(2.5)"})
        .from($(".member-q p",m),{x:-30,opacity:0,duration:.455,ease:"power3.out"},"-=.4")
        .from($(".media-panel",m),{xPercent:-40,opacity:0,duration:.585,ease:"expo.out"},"-=.5")
        .fromTo($(".portrait",m),{clipPath:"inset(100% 0% 0% 0% round 22px)"},{clipPath:"inset(0% 0% 0% 0% round 22px)",duration:.78,ease:"expo.inOut"},"-=.8")
        .from($(".portrait-in",m),{scale:1.35,duration:.91,ease:"expo.out"},"-=.9")
        .fromTo($(".member-media .draw",m),{strokeDasharray:200,strokeDashoffset:200},{strokeDashoffset:0,duration:.585,ease:"power2.inOut"},"-=.9")
        .from($$(".soc",m),{scale:0,stagger:.05,duration:.325,ease:"back.out(3)"},"-=.7")
        .from($("h3",m)._parts,{yPercent:120,opacity:0,stagger:.03,duration:.52,ease:"expo.out"},"-=1")
        .from($$(".role, .bio",m),{y:20,opacity:0,stagger:.06,duration:.455},"-=.6")
        .from($(".skills",m),{y:30,opacity:0,duration:.455,ease:"power3.out"},"-=.4")
        .from($$(".skills li",m),{scale:.4,opacity:0,stagger:.07,duration:.325,ease:"back.out(2.5)"},"-=.3");
      gsap.to($(".media-panel",m),{y:-8,ease:"none",scrollTrigger:{trigger:m,start:"top bottom",end:"bottom top",scrub:true}});
    });

    /* ===== Contact ===== */
    gsap.from(".contact-embed",{y:60,opacity:0,duration:.65,ease:"expo.out",scrollTrigger:{trigger:".contact-embed",start:"top 80%"}});

    /* ===== FAQ ===== */
    gsap.from(".faq-item",{y:40,opacity:0,stagger:.05,duration:.455,ease:"power3.out",scrollTrigger:{trigger:".faq-list",start:"top 85%"}});

    /* ===== Footer ===== */
    var foot = gsap.timeline({scrollTrigger:{trigger:".footer",start:"top 85%"}});
    foot.from(".footer",{borderRadius:"120px 120px 0 0",duration:.78,ease:"expo.out"})
        .from(".foot-col",{y:40,opacity:0,stagger:.06,duration:.52,ease:"power3.out"},"-=1")
        .from(".foot-bottom",{opacity:0,duration:.39},"-=.3");

    /* ===== Boutons magnétiques + curseur ===== */
    if(fine){
      $$(".magnetic").forEach(function(b){
        var xT = gsap.quickTo(b,"x",{duration:.325,ease:"power3"}), yT = gsap.quickTo(b,"y",{duration:.325,ease:"power3"});
        b.addEventListener("pointermove",function(e){var r=b.getBoundingClientRect();xT((e.clientX-r.left-r.width/2)*.3);yT((e.clientY-r.top-r.height/2)*.4);});
        b.addEventListener("pointerleave",function(){gsap.to(b,{x:0,y:0,duration:.52,ease:"elastic.out(1,.35)"});});
      });
      var cur = $(".cursor"), cx = gsap.quickTo(cur,"x",{duration:.25,ease:"power3"}), cy = gsap.quickTo(cur,"y",{duration:.25,ease:"power3"});
      window.addEventListener("pointermove",function(e){ cur.style.opacity = 1; cx(e.clientX); cy(e.clientY); });
      $$("a, button, label, .sub").forEach(function(el){
        el.addEventListener("pointerenter",function(){cur.classList.add("is-hover")});
        el.addEventListener("pointerleave",function(){cur.classList.remove("is-hover")});
      });
    }

    return function(){ /* nettoyage géré par matchMedia */ };
  });

  /* ---------- Méthode : section centrée sur desktop/tablette, cards sticky sur mobile ---------- */
  function initMethod(){
    mm.add({wide:"(min-width:601px)",mobile:"(max-width:600px)",motion:"(prefers-reduced-motion:no-preference)"},function(ctx){
      if(!ctx.conditions.motion) return;
      var section = $("#methode"), stage = $(".method-stage",section), steps = $$(".step",section);
      function measure(){
        section.style.removeProperty("--steps-height");
        section.style.removeProperty("--mobile-step-height");
        var height = Math.ceil(Math.max.apply(null, steps.map(function(step){return step.offsetHeight;})));
        section.style.setProperty(ctx.conditions.wide ? "--steps-height" : "--mobile-step-height",height+"px");
      }
      if(ctx.conditions.wide) section.classList.add("method-is-pinned");
      measure();
      ScrollTrigger.addEventListener("refreshInit",measure);
      var fills = steps.map(function(step){return $(".num-f",step);});
      if(ctx.conditions.wide){
        // Les prochaines cartes restent masquées jusqu'au début de leur entrée.
        steps.forEach(function(step,i){gsap.set(step,{autoAlpha:i === 0 ? 1 : 0,yPercent:i === 0 ? 0 : 100,zIndex:i+1});});
        gsap.set(fills,{clipPath:"inset(100% 0% 0% 0%)"});
        var activeStep = -1;
        function activate(index){
          if(index === activeStep) return;
          activeStep = index;
          steps.forEach(function(step,i){step.inert = i !== index;});
        }
        var methodTl = gsap.timeline({scrollTrigger:{
          trigger:stage,
          start:function(){return "top " + Math.max(80,(window.innerHeight-stage.offsetHeight)/2) + "px";},
          end:function(){return "+=" + Math.max(900,window.innerHeight*1.6);},
          pin:true,scrub:.15,
          onUpdate:function(st){activate(st.progress < 1.25/2.85 ? 0 : st.progress < 2.25/2.85 ? 1 : 2);},
          onRefresh:function(st){activate(st.progress < 1.25/2.85 ? 0 : st.progress < 2.25/2.85 ? 1 : 2);}
        }});
        methodTl.to(fills[0],{clipPath:"inset(-3px -3px -3px -3px)",duration:.35,ease:"none"},0)
          .to({}, {duration:.25},.35);
        steps.slice(1).forEach(function(step,i){
          var at = .6+i;
          var coveredContent = [$(".step-num",steps[i])].concat($$(".step-card > *",steps[i]));
          methodTl.set(step,{autoAlpha:1},at)
            .to(step,{yPercent:0,duration:.65,ease:"power2.inOut"},at)
            .set(coveredContent,{autoAlpha:0},at+.65)
            // Le chiffre se remplit une fois la nouvelle carte entièrement visible.
            .fromTo(fills[i+1],{clipPath:"inset(100% 0% 0% 0%)"},
              {clipPath:"inset(-3px -3px -3px -3px)",duration:.35,ease:"none",immediateRender:false},at+.65);
        });
        // Garder le dernier chiffre entièrement rempli avant de libérer la section.
        methodTl.to({}, {duration:.25});
        gsap.from($(".step-card",steps[0]),{y:40,opacity:0,duration:.5,ease:"power3.out",scrollTrigger:{trigger:stage,start:"top 85%"}});
      } else {
        steps.forEach(function(step,i){
          gsap.fromTo(fills[i],{clipPath:"inset(100% 0% 0% 0%)"},{clipPath:"inset(-3px -3px -3px -3px)",ease:"none",scrollTrigger:{trigger:step,start:"top 85%",end:"top 25%",scrub:.2}});
          gsap.from($(".step-card",step),{y:32,opacity:0,duration:.45,ease:"power3.out",scrollTrigger:{trigger:step,start:"top 85%"}});
          if(i === 0) return;
          ScrollTrigger.create({trigger:step,start:"top 89px",end:"bottom top",
            onEnter:function(){gsap.set(steps[i-1],{autoAlpha:0});steps[i-1].inert=true;},
            onLeaveBack:function(){gsap.set(steps[i-1],{autoAlpha:1});steps[i-1].inert=false;}});
        });
      }
      return function(){
        section.classList.remove("method-is-pinned");
        section.style.removeProperty("--steps-height");section.style.removeProperty("--mobile-step-height");
        ScrollTrigger.removeEventListener("refreshInit",measure);
        steps.forEach(function(step){step.inert=false;});
      };
    });
    ScrollTrigger.refresh();
  }
  document.fonts.ready.then(initMethod);

  window.addEventListener("load", function(){ ScrollTrigger.refresh(); });
})();
