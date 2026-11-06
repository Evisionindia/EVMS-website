// Public product copy and visuals for the E-VMS landing page.
export function operatorHome(board, chooser) {
  return `<section class="operator-hero">
    <div class="operator-hero-inner">
      <div class="operator-intro">
        <p class="product-name"><i aria-hidden="true"></i>E-VMS <span>/</span> VIDEO MANAGEMENT</p>
        <h1>Monitor cameras.<br><em>Review incidents.</em></h1>
        <p class="operator-lede">Bring camera and NVR channels into one operator workspace. Move from live view to recorded footage and the incident that needs attention.</p>
        <div class="operator-actions"><a class="primary-action" href="/contact#demo">Request a demo <span aria-hidden="true">↗</span></a><a class="secondary-action" href="#workflow">Explore the workflow <span aria-hidden="true">↓</span></a></div>
      </div>
      <figure class="playback-portrait">
        <a href="/assets/operator-playback.png" aria-label="Open full-size E-VMS recording playback screen"><img src="/assets/operator-playback.png" width="1098" height="861" alt="E-VMS playback with the Recordings sidebar, channel controls and recording timeline" fetchpriority="high"></a>
        <figcaption>Recording playback <span>· Synthetic demonstration clip</span></figcaption>
      </figure>
    </div>
  </section>
  <section class="operations-strip" aria-label="Operator workflow"><div>
    <a href="#onboard">Camera onboarding <span aria-hidden="true">↘</span></a>
    <a href="#workflow">Live monitoring <span aria-hidden="true">↘</span></a>
    <a href="/workflow">Recording playback <span aria-hidden="true">↗</span></a>
    <a href="#incident-review">Incident review <span aria-hidden="true">↘</span></a>
  </div></section>
  <section class="onboard-story" id="onboard"><div class="onboard-grid">
    <div class="onboard-copy"><p class="section-label">DEVICE MANAGEMENT</p><h2>Connect a recorder.<br>Find its channels.</h2><p>Choose a site, add an NVR and let E-VMS check the recorder connection. Review discovered channels before adding them to the camera tree.</p><a class="secondary-action" href="/deployment">Plan your deployment <span aria-hidden="true">↗</span></a> <a class="secondary-action" href="/downloads">View downloads <span aria-hidden="true">↗</span></a></div>
    <figure class="onboard-screen"><img src="/assets/nvr-onboarding.webp" alt="E-VMS Add NVR dialog with site, recorder address and ONVIF authentication fields" width="980" height="476" loading="lazy"><figcaption>E-VMS operator application <span> / </span> NVR Management</figcaption></figure>
  </div></section>
  <section id="workflow" class="wrap showcase operator-workflow"><div class="showcase-head"><p class="section-label">OPERATOR WORKSPACE</p><h2>From live view to playback.</h2><p>Explore camera groups, recording storage, playback and operator access in the illustrated walkthrough.</p></div>${board}<div class="workflow-explorer">${chooser}</div></section>
  <section id="incident-review" class="incident-story"><div><p class="section-label">INCIDENT REVIEW</p><h2>Follow the camera<br>and the time.</h2></div><div><p>Open an alert, identify its camera and time, and review the matching recording where footage is available. Select the relevant range and export a separate clip.</p><a class="secondary-action" href="/product">View product capabilities <span aria-hidden="true">↗</span></a></div></section>
  <section class="contact-band"><div><h2>See E-VMS with your team.</h2><p>Discuss your camera layout, storage and operator workflows.</p></div><a class="primary-action" href="/contact#demo">Request a demo <span aria-hidden="true">↗</span></a></section>`;
}