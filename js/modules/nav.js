/* ============================================================
   頂端選單：捲動到哪個區塊，就高亮對應的選單項目
   ============================================================ */
window.Trip = window.Trip || {};

Trip.nav = {
  init() {
    const links = [...document.querySelectorAll(".nav-link")];
    const sections = links
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    /* 網址的 # 用來切換行程，所以選單改用捲動，不改網址 */
    links.forEach((link) => {
      link.addEventListener("click", (e) => {
        const target = document.querySelector(link.getAttribute("href"));
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: Trip.utils.prefersReducedMotion() ? "auto" : "smooth" });
      });
    });

    if (!("IntersectionObserver" in window) || !sections.length) return;

    const setActive = (id) => {
      links.forEach((link) => {
        const active = link.getAttribute("href") === `#${id}`;
        link.classList.toggle("is-active", active);
        if (active) link.setAttribute("aria-current", "true");
        else link.removeAttribute("aria-current");
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );

    sections.forEach((section) => observer.observe(section));

    /* 回到首頁時取消高亮 */
    const home = document.getElementById("home");
    if (home) {
      new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(null);
        },
        { rootMargin: "-40% 0px -55% 0px" }
      ).observe(home);
    }
  },
};
