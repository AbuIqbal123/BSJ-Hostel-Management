(function () {
  var ROLE = {
    resident: "You are the resident",
    gate: "You are gate staff",
    warden: "You are the warden",
    parent: "Parent phone",
    done: "Begum Sultan Jahan Hall"
  };

  var ICONS =
    '<svg xmlns="http://www.w3.org/2000/svg" hidden id="demo-icons">' +
    '<symbol id="i-signal" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="0.6" fill="currentColor"/><rect x="5" y="5" width="3" height="7" rx="0.6" fill="currentColor"/><rect x="10" y="2.5" width="3" height="9.5" rx="0.6" fill="currentColor"/><rect x="15" y="0" width="3" height="12" rx="0.6" fill="currentColor" opacity=".35"/></symbol>' +
    '<symbol id="i-wifi" viewBox="0 0 16 12"><path d="M1.2 4.2C4.4 1.4 11.6 1.4 14.8 4.2M3.4 6.5c2.2-1.8 6.9-1.8 9.1 0M6.2 8.8c1-0.8 2.6-0.8 3.6 0" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="8" cy="11" r="1.1" fill="currentColor"/></symbol>' +
    '<symbol id="i-battery" viewBox="0 0 25 12"><rect x="0.6" y="1.2" width="21" height="9.6" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="2.4" y="3" width="15.2" height="6" rx="1" fill="currentColor"/><rect x="22.4" y="4" width="1.6" height="4" rx="0.6" fill="currentColor"/></symbol>' +
    '<symbol id="i-chev" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-door" viewBox="0 0 24 24"><path d="M10 7V5.6A1.6 1.6 0 0 1 11.6 4h7.8A1.6 1.6 0 0 1 21 5.6v12.8A1.6 1.6 0 0 1 19.4 20H11.6A1.6 1.6 0 0 1 10 18.4V17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M3.5 12H15M12 8.5L15.5 12 12 15.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-qr" viewBox="0 0 24 24"><path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M14 14h2.5v2.5H14V14zm4.5 0H21v3h-2.5v-3zM14 18.5H17V21h-3v-2.5zm5.2 0H21V21h-1.8v-2.5z" fill="currentColor"/></symbol>' +
    '<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v4.2l3 1.8" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3.5l7 2.4v6.3c0 4.2-2.8 6.8-7 8.3-4.2-1.5-7-4.1-7-8.3V5.9L12 3.5z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M9.2 12.1l1.9 1.9 3.8-4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-alert" viewBox="0 0 24 24"><path d="M12 4.2L3.8 19h16.4L12 4.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M12 10v4.2M12 16.8h.01" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16 16.5L20 20.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-check" viewBox="0 0 24 24"><path d="M5 12.5l5 5 9-10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-scan" viewBox="0 0 24 24"><path d="M4 8V5.8A1.8 1.8 0 0 1 5.8 4H8M16 4h2.2A1.8 1.8 0 0 1 20 5.8V8M20 16v2.2a1.8 1.8 0 0 1-1.8 1.8H16M8 20H5.8A1.8 1.8 0 0 1 4 18.2V16M3 12h18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-moon" viewBox="0 0 24 24"><path d="M15.5 4.2A7.8 7.8 0 1 0 19.6 15 6.4 6.4 0 0 1 15.5 4.2z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-home" viewBox="0 0 24 24"><path d="M4 11.2L12 4.5l8 6.7V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></symbol>' +
    '<symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.2" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M5.5 19c.8-3.2 3.3-5 6.5-5s5.7 1.8 6.5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>' +
    '<symbol id="i-list" viewBox="0 0 24 24"><path d="M8 7h12M8 12h12M8 17h12M4 7h.01M4 12h.01M4 17h.01" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></symbol>' +
    "</svg>";

  function injectIcons() {
    if (document.getElementById("demo-icons")) return;
    var wrap = document.createElement("div");
    wrap.innerHTML = ICONS;
    var svg = wrap.firstElementChild;
    if (svg) document.body.insertBefore(svg, document.body.firstChild);
  }

  function screenById(id) {
    return document.querySelector('[data-screen="' + id + '"]');
  }

  function show(id) {
    var target = screenById(id);
    if (!target) return;

    document.querySelectorAll("[data-screen]").forEach(function (el) {
      el.classList.toggle("is-on", el === target);
    });

    var role = target.getAttribute("data-role") || "";
    var banner = document.querySelector(".role-banner");
    var label = document.querySelector("[data-role-banner]");
    if (label) label.textContent = ROLE[role] || ROLE.done;
    if (banner) banner.setAttribute("data-role", role || "done");

    var phone = document.querySelector("[data-phone]");
    var slot = document.querySelector("[data-phone-slot]");
    var inPhone = Boolean(target.closest("[data-phone]"));
    if (slot) slot.hidden = !inPhone;
    if (phone) {
      var phoneRole = role === "parent" || role === "done" ? "resident" : role;
      phone.setAttribute("data-role", phoneRole || "resident");
    }

    var time = target.getAttribute("data-time");
    var timeEl = document.querySelector("[data-os-time]");
    if (time && timeEl) timeEl.textContent = time;

    var screenEl = document.querySelector(".device-screen");
    if (screenEl) {
      screenEl.classList.toggle("has-tabs", Boolean(target.querySelector(".tabbar")));
    }

    document.querySelectorAll("[data-for]").forEach(function (li) {
      var ids = li.getAttribute("data-for").split(",").map(function (s) {
        return s.trim();
      });
      li.classList.toggle("is-current", ids.indexOf(id) !== -1);
    });

    if (history.replaceState) {
      history.replaceState(null, "", "#" + id);
    }

    requestAnimationFrame(fitPhone);
  }

  function isPhone() {
    return window.matchMedia("(max-width: 860px)").matches;
  }

  function fitPhone() {
    var slot = document.querySelector("[data-phone-slot]");
    var device = document.querySelector("[data-phone]");
    var stage = document.querySelector(".phone-stage");
    document.body.classList.toggle("is-phone", isPhone());
    if (!slot || !device || !stage || slot.hidden) return;

    if (isPhone()) {
      device.style.transform = "none";
      slot.style.width = "100%";
      slot.style.height = "100%";
      return;
    }

    var natW = 412;
    var natH = 866;
    var banner = document.querySelector(".role-banner");
    var bh = banner ? banner.getBoundingClientRect().height : 48;
    var stepList = document.querySelector(".step-list");
    var stepsVisible = stepList && window.getComputedStyle(stepList).display !== "none";
    var stepW = stepsVisible ? stepList.getBoundingClientRect().width : 0;
    var styles = window.getComputedStyle(stage);
    var padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    var padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    var w = window.innerWidth - stepW - padX;
    var h = window.innerHeight - bh - padY;
    var s = Math.min(w / natW, h / natH, 1);
    if (!isFinite(s) || s <= 0) s = 1;
    device.style.transform = "scale(" + s + ")";
    device.style.transformOrigin = "top center";
    slot.style.width = natW * s + "px";
    slot.style.height = natH * s + "px";
  }

  function onGo(event) {
    var go = event.target.closest("[data-go]");
    if (!go) return;
    var id = go.getAttribute("data-go");
    if (!id || !screenById(id)) return;
    event.preventDefault();
    show(id);
  }

  injectIcons();
  document.addEventListener("click", onGo);
  window.addEventListener("resize", fitPhone);
  window.addEventListener("orientationchange", fitPhone);
  window.addEventListener("hashchange", function () {
    var id = location.hash.replace(/^#/, "");
    if (id) show(id);
  });

  var initial = location.hash.replace(/^#/, "");
  var first = document.querySelector("[data-screen]");
  var start = initial && screenById(initial) ? initial : first ? first.getAttribute("data-screen") : null;
  if (start) show(start);
  else fitPhone();
  window.addEventListener("load", fitPhone);
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(fitPhone);
  }
})();
