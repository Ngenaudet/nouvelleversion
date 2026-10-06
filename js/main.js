/* Nouvelle Version · interactions et animations (GSAP + ScrollTrigger) */
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

  /* ---------- FAQ (fonctionne aussi sans GSAP : le CSS ouvre .is-open) ---------- */
  function closeItem(item){
    var p = item.querySelector(".faq-a"), h = p.offsetHeight;
    item.classList.remove("is-open"); item.querySelector(".faq-q").setAttribute("aria-expanded","false");
    if(hasGsap) gsap.fromTo(p,{height:h},{height:0,duration:.45,ease:"power3.inOut",clearProps:"height"});
  }
  function openItem(item){
    var p = item.querySelector(".faq-a");
    item.classList.add("is-open"); item.querySelector(".faq-q").setAttribute("aria-expanded","true");
    if(hasGsap){ gsap.fromTo(p,{height:0},{height:"auto",duration:.55,ease:"power3.out",clearProps:"height"}); gsap.from(p.querySelector("p"),{y:12,opacity:0,duration:.5,delay:.1}); }
  }
  $$(".faq-q").forEach(function(btn){
    btn.addEventListener("click", function(){
      var item = btn.closest(".faq-item"), wasOpen = item.classList.contains("is-open");
      $$(".faq-item.is-open").forEach(function(other){ if(other !== item) closeItem(other); });
      wasOpen ? closeItem(item) : openItem(item);
    });
  });

  /* ---------- Formulaire (statique : à brancher sur votre outil) ---------- */
  var form = $("#contact-form"), msg = $("#form-msg");
  form.addEventListener("submit", function(e){
    e.preventDefault();
    var invalid = $$("[required]", form).filter(function(f){ return f.type==="checkbox" ? !f.checked : !f.value.trim() || (f.type==="email" && !/^\S+@\S+\.\S+$/.test(f.value)); });
    $$(".input", form).forEach(function(f){ f.style.borderColor = ""; });
    if(invalid.length){
      msg.hidden = false; msg.textContent = "Il manque " + invalid.length + " information(s) : vérifiez les champs surlignés et la case de consentement.";
      invalid.forEach(function(f){ if(f.classList.contains("input")) f.style.borderColor = "var(--orange-deep)"; });
      if(hasGsap) gsap.fromTo(form,{x:-8},{x:0,duration:.5,ease:"elastic.out(1,.3)"});
      invalid[0].focus(); return;
    }
    msg.hidden = false; msg.textContent = "Merci " + $("#f-prenom").value.trim() + " ! Votre demande est prête. Nous revenons vers vous sous 48h.";
    if(hasGsap) gsap.from(msg,{y:16,opacity:0,duration:.6,ease:"back.out(2)"});
    form.reset();
  });

  /* ---------- Menu mobile ---------- */
  var burgers = $$(".burger"), menu = $("#mobile-menu"), menuTl = null;
  function setMenu(open){
    document.body.classList.toggle("menu-open", open);
    burgers.forEach(function(b){ b.setAttribute("aria-expanded", String(open)); b.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu"); });
    menu.setAttribute("aria-hidden", String(!open));
    if(!hasGsap){ menu.style.visibility = open?"visible":"hidden"; menu.style.clipPath = open?"none":""; return; }
    if(!menuTl){
      menuTl = gsap.timeline({paused:true})
        .set(menu,{visibility:"visible"})
        .to(menu,{clipPath:"circle(150% at calc(100% - 40px) 40px)",duration:.8,ease:"power3.inOut"})
        .from($$(".mm-link",menu),{y:60,opacity:0,stagger:.07,duration:.6,ease:"expo.out"},"-=.35")
        .from($$(".mm-contact > *",menu),{y:20,opacity:0,stagger:.06,duration:.4},"-=.3");
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
    intro.from("#header .logo",{yPercent:-110,duration:1})
      .from("#header .nav-pill",{y:-30,opacity:0,duration:.8},"-=.7")
      .from("#header .nav-pill a",{y:12,opacity:0,stagger:.06,duration:.5},"-=.5")
      .from("#header .hdr-right > *",{x:50,opacity:0,stagger:.08,duration:.8},"-=.7")
      .from(".hero .eyebrow",{y:20,opacity:0,duration:.7},"-=.6")
      .from(heroTitle._parts,{yPercent:115,rotate:6,duration:1.1,stagger:.07},"-=.5")
      .fromTo(".hero .squiggle .draw",{strokeDasharray:200,strokeDashoffset:200},{strokeDashoffset:0,duration:1,ease:"power2.inOut"},"-=.7")
      .from(".stat",{y:30,opacity:0,stagger:.1,duration:.8},"-=.7")
      .from(".avatar",{scale:0,x:-30,stagger:.1,duration:.7,ease:"back.out(2)"},"-=.6")
      .from(".collab > div:last-child, .hero-lead",{x:30,opacity:0,stagger:.1,duration:.7},"-=.4")
      .from(".offer",{y:160,opacity:0,rotateX:-25,transformOrigin:"50% 100%",stagger:.14,duration:1.3},"-=.6")
      .from(".glyph",{yPercent:35,scale:1.25,opacity:0,stagger:.14,duration:1.4,ease:"expo.out"},"-=1.1")
      .from(".offer-panel",{yPercent:12,opacity:0,stagger:.14,duration:1,ease:"expo.out"},"-=1.3")
      .from(".offer-list li",{x:-14,opacity:0,stagger:.02,duration:.4},"-=.8");

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

    /* Tilt 3D des cartes + parallaxe souris */
    if(fine){
      $$("[data-tilt]").forEach(function(card){
        var glyph = $(".glyph",card), rx = gsap.quickTo(card,"rotationX",{duration:.6,ease:"power3"}), ry = gsap.quickTo(card,"rotationY",{duration:.6,ease:"power3"}),
            gx = gsap.quickTo(glyph,"x",{duration:.8,ease:"power3"}), gy = gsap.quickTo(glyph,"y",{duration:.8,ease:"power3"});
        card.addEventListener("pointermove",function(e){
          var r = card.getBoundingClientRect(), px = (e.clientX-r.left)/r.width-.5, py = (e.clientY-r.top)/r.height-.5;
          ry(px*12); rx(-py*10); gx(px*30); gy(py*20);
        });
        card.addEventListener("pointerleave",function(){ rx(0); ry(0); gx(0); gy(0); });
      });
      var hero = $(".hero");
      hero.addEventListener("pointermove",function(e){
        var px = e.clientX/innerWidth-.5, py = e.clientY/innerHeight-.5;
        gsap.to(".blob--1",{xPercent:px*40,yPercent:py*40,duration:1.4,overwrite:"auto"});
        gsap.to(".avatars",{x:px*14,y:py*10,duration:1});
      });
    }

    /* ===== Marquees avec accélération selon la vitesse de scroll ===== */
    $$(".marquee").forEach(function(m){
      var track = $(".marquee-track",m), right = m.dataset.dir === "right";
      var tw = gsap.fromTo(track,{xPercent:right?-50:0},{xPercent:right?0:-50,duration:right?34:30,ease:"none",repeat:-1});
      gsap.from(m,{xPercent:right?-20:20,opacity:0,duration:1.2,ease:"expo.out",scrollTrigger:{trigger:m,start:"top 95%"}});
      ScrollTrigger.create({trigger:m,start:"top bottom",end:"bottom top",onUpdate:function(self){
        var boost = 1 + Math.min(Math.abs(self.getVelocity())/350, 6);
        gsap.to(tw,{timeScale:boost,duration:.2,overwrite:true,onComplete:function(){ gsap.to(tw,{timeScale:1,duration:1.2,ease:"power2.out"}); }});
      }});
      gsap.to(m,{rotate:right?-1.5:2,ease:"none",scrollTrigger:{trigger:m,start:"top bottom",end:"bottom top",scrub:true}});
    });

    /* ===== Titres en lettres ===== */
    $$("[data-split='chars']").forEach(function(h){
      gsap.from(h._parts,{yPercent:120,rotate:12,opacity:0,stagger:.025,duration:.9,ease:"expo.out",scrollTrigger:{trigger:h,start:"top 85%"}});
    });
    $$(".section .eyebrow, .faq .eyebrow, .about .eyebrow").forEach(function(e){
      gsap.from(e,{y:16,opacity:0,scale:.9,duration:.7,ease:"back.out(2)",scrollTrigger:{trigger:e,start:"top 90%"}});
    });
    $$(".reveal").forEach(function(r){
      gsap.from(r,{y:30,opacity:0,duration:.9,ease:"power3.out",scrollTrigger:{trigger:r,start:"top 88%"}});
    });

    /* ===== Méthode : chiffres outline qui se remplissent ===== */
    $$(".step").forEach(function(step,i){
      var num = $(".step-num",step), card = $(".step-card",step), subs = $$(".sub",step);
      gsap.fromTo($(".num-f",num),{clipPath:"inset(100% 0% 0% 0%)"},{clipPath:"inset(0% 0% 0% 0%)",ease:"none",immediateRender:true,scrollTrigger:{trigger:step,start:"top 85%",end:"top 30%",scrub:.6}});
      gsap.from(num,{xPercent:-25,opacity:0,duration:1.2,ease:"expo.out",scrollTrigger:{trigger:step,start:"top 85%"}});
      var tl = gsap.timeline({scrollTrigger:{trigger:step,start:"top 78%"}});
      tl.from(card,{x:100,opacity:0,duration:1,ease:"expo.out"})
        .from($("h3",card),{y:20,opacity:0,duration:.6},"-=.6")
        .from(subs,{y:50,opacity:0,rotate:i%2?-2:2,stagger:.12,duration:.8,ease:"back.out(1.4)"},"-=.4");
    });
    /* Empilement : l'étape recouverte recule pendant que la suivante arrive */
    var stepEls = $$(".step");
    stepEls.forEach(function(step,i){
      var next = stepEls[i+1]; if(!next) return;
      var stickTop = parseFloat(getComputedStyle(next).top) || 100;
      var st = {trigger:next,start:"top bottom",end:"top " + stickTop + "px",scrub:true};
      gsap.to($(".step-card",step),{scale:.93,transformOrigin:"50% 0%",ease:"none",scrollTrigger:st});
    });
    /* Fusée */
    var rocketTl = gsap.timeline({repeat:-1,yoyo:true});
    rocketTl.to(".rocket",{x:6,y:-8,rotate:-4,duration:1.4,ease:"sine.inOut"});
    gsap.to(".flame",{scale:1.25,transformOrigin:"100% 0%",opacity:.6,duration:.18,repeat:-1,yoyo:true,ease:"none"});
    $$(".star").forEach(function(s,i){ gsap.to(s,{opacity:.2,scale:.6,duration:.8+i*.2,repeat:-1,yoyo:true,ease:"sine.inOut"}); });
    gsap.from(".rocket",{x:-120,y:120,opacity:0,duration:1.4,ease:"expo.out",scrollTrigger:{trigger:".sub--launch",start:"top 85%"}});

    /* ===== CTA : ouverture en clip-path ===== */
    gsap.fromTo(".cta",{clipPath:"inset(12% 14% 12% 14% round 60px)"},{clipPath:"inset(0% 0% 0% 0% round 28px)",ease:"none",scrollTrigger:{trigger:".cta",start:"top 92%",end:"top 45%",scrub:true}});
    gsap.from($("#cta-title")._parts,{yPercent:110,stagger:.06,duration:1,ease:"expo.out",scrollTrigger:{trigger:".cta",start:"top 70%"}});
    gsap.to(".cta .ring--1",{rotate:360,scale:1.2,ease:"none",scrollTrigger:{trigger:".cta",start:"top bottom",end:"bottom top",scrub:true}});
    gsap.to(".cta .ring--2",{scale:1.5,ease:"none",scrollTrigger:{trigger:".cta",start:"top bottom",end:"bottom top",scrub:true}});

    /* ===== À propos : mots qui s'allument au scroll ===== */
    if(scrub){
      gsap.set(scrub._parts,{opacity:.28});
      gsap.to(scrub._parts,{opacity:1,stagger:.1,ease:"none",scrollTrigger:{trigger:scrub,start:"top 80%",end:"bottom 45%",scrub:true}});
      gsap.from(scrub,{y:60,duration:1,ease:"none",scrollTrigger:{trigger:".about",start:"top bottom",end:"center center",scrub:true}});
    }

    /* ===== Équipe ===== */
    $$(".member").forEach(function(m,i){
      var tl = gsap.timeline({scrollTrigger:{trigger:m,start:"top 75%"}});
      tl.from($(".q-ico",m),{scale:0,rotate:-180,duration:.7,ease:"back.out(2.5)"})
        .from($(".member-q p",m),{x:-30,opacity:0,duration:.7,ease:"power3.out"},"-=.4")
        .from($(".media-panel",m),{xPercent:-40,opacity:0,duration:.9,ease:"expo.out"},"-=.5")
        .fromTo($(".portrait",m),{clipPath:"inset(100% 0% 0% 0% round 22px)"},{clipPath:"inset(0% 0% 0% 0% round 22px)",duration:1.2,ease:"expo.inOut"},"-=.8")
        .from($(".portrait-in",m),{scale:1.35,duration:1.4,ease:"expo.out"},"-=.9")
        .fromTo($(".member-media .draw",m),{strokeDasharray:200,strokeDashoffset:200},{strokeDashoffset:0,duration:.9,ease:"power2.inOut"},"-=.9")
        .from($$(".soc",m),{scale:0,stagger:.08,duration:.5,ease:"back.out(3)"},"-=.7")
        .from($("h3",m)._parts,{yPercent:120,opacity:0,stagger:.03,duration:.8,ease:"expo.out"},"-=1")
        .from($$(".role, .bio",m),{y:20,opacity:0,stagger:.1,duration:.7},"-=.6")
        .from($(".skills",m),{y:30,opacity:0,duration:.7,ease:"power3.out"},"-=.4")
        .from($$(".skills li",m),{scale:.4,opacity:0,stagger:.07,duration:.5,ease:"back.out(2.5)"},"-=.3");
      gsap.to($(".portrait-in",m),{yPercent:10,ease:"none",scrollTrigger:{trigger:m,start:"top bottom",end:"bottom top",scrub:true}});
      gsap.to($(".media-panel",m),{y:-30,ease:"none",scrollTrigger:{trigger:m,start:"top bottom",end:"bottom top",scrub:true}});
      if(fine){
        var por = $(".portrait",m);
        por.addEventListener("pointermove",function(e){var r=por.getBoundingClientRect();gsap.to(por,{rotationY:((e.clientX-r.left)/r.width-.5)*14,rotationX:-((e.clientY-r.top)/r.height-.5)*14,transformPerspective:800,duration:.5});});
        por.addEventListener("pointerleave",function(){gsap.to(por,{rotationY:0,rotationX:0,duration:.8,ease:"elastic.out(1,.4)"});});
      }
    });

    /* ===== Contact ===== */
    var ftl = gsap.timeline({scrollTrigger:{trigger:".form",start:"top 80%"}});
    ftl.from(".form",{y:80,opacity:0,scale:.96,duration:1,ease:"expo.out"})
       .from(".form .field, .form .consent, .form > div:last-child",{y:24,opacity:0,stagger:.08,duration:.6,ease:"power3.out"},"-=.6")
       .from(".chip",{scale:0,stagger:.08,duration:.5,ease:"back.out(2.5)"},"-=.6");
    $$(".chip input").forEach(function(r){ r.addEventListener("change",function(){ gsap.fromTo(r.nextElementSibling,{scale:.9},{scale:1,duration:.6,ease:"elastic.out(1,.35)"}); }); });
    $$(".input").forEach(function(f){ f.addEventListener("focus",function(){ gsap.fromTo(f,{scale:.985},{scale:1,duration:.4,ease:"back.out(3)"}); }); });

    /* ===== FAQ ===== */
    gsap.from(".faq-item",{y:40,opacity:0,stagger:.08,duration:.7,ease:"power3.out",scrollTrigger:{trigger:".faq-list",start:"top 85%"}});

    /* ===== Footer ===== */
    var foot = gsap.timeline({scrollTrigger:{trigger:".footer",start:"top 85%"}});
    foot.from(".footer",{borderRadius:"120px 120px 0 0",duration:1.2,ease:"expo.out"})
        .from(".foot-col",{y:40,opacity:0,stagger:.1,duration:.8,ease:"power3.out"},"-=1")
        .from(".foot-bottom",{opacity:0,duration:.6},"-=.3");
    gsap.fromTo(".foot-giant",{xPercent:15},{xPercent:-15,ease:"none",scrollTrigger:{trigger:".footer",start:"top bottom",end:"bottom bottom",scrub:true}});

    /* ===== Boutons magnétiques + curseur ===== */
    if(fine){
      $$(".magnetic").forEach(function(b){
        var xT = gsap.quickTo(b,"x",{duration:.5,ease:"power3"}), yT = gsap.quickTo(b,"y",{duration:.5,ease:"power3"});
        b.addEventListener("pointermove",function(e){var r=b.getBoundingClientRect();xT((e.clientX-r.left-r.width/2)*.3);yT((e.clientY-r.top-r.height/2)*.4);});
        b.addEventListener("pointerleave",function(){gsap.to(b,{x:0,y:0,duration:.8,ease:"elastic.out(1,.35)"});});
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

  window.addEventListener("load", function(){ ScrollTrigger.refresh(); });
})();
