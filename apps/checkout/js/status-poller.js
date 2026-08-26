// =========================================================
// Real-time Status Poller (Lightweight Edge Polling)
// =========================================================

export class CheckoutStatusPoller {
  constructor(orderId, onPaid) {
    this.orderId = orderId;
    this.onPaid = onPaid;
    this.timer = null;
    this.isPolling = false;
  }

  start() {
    if (this.isPolling) return;
    this.isPolling = true;

    const API_ENDPOINT = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1')
      ? `http://localhost:8787/api/v1/checkout/${this.orderId}/status`
      : `/api/v1/checkout/${this.orderId}/status`;

    const poll = async () => {
      if (!this.isPolling) return;

      try {
        const res = await fetch(API_ENDPOINT);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'paid') {
            this.stop();
            if (this.onPaid) this.onPaid(data);
            return;
          }
        }
      } catch (err) {
        console.warn('Status poll error:', err);
      }

      if (this.isPolling) {
        this.timer = setTimeout(poll, 2500); // Check every 2.5s
      }
    };

    // Begin polling immediately
    poll();

    // Max polling duration: 8 minutes
    setTimeout(() => this.stop(), 8 * 60 * 1000);
  }

  stop() {
    this.isPolling = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
