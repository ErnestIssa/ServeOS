export function App() {
  return (
    <div className="page">
      <header className="header">
        <div className="brand">ServeOS</div>
        <div className="pill">Customer Ordering</div>
      </header>

      <main className="content">
        <h1>Customer Web</h1>
        <p>Scaffold is running. Next: QR table session, menu browsing, cart, checkout.</p>

        <div className="card">
          <div className="row">
            <div>
              <div className="label">Example table</div>
              <div className="value">T-12</div>
            </div>
            <button className="button" type="button">
              Start order
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

