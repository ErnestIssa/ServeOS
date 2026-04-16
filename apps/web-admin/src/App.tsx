export function App() {
  return (
    <div className="page">
      <header className="header">
        <div className="brand">ServeOS</div>
        <div className="pill">Admin Dashboard</div>
      </header>

      <main className="content">
        <h1>Web Admin</h1>
        <p>Scaffold is running. Next: auth, restaurants, menus, tables, analytics.</p>

        <div className="grid">
          <section className="card">
            <h2>Restaurants</h2>
            <p>Create and manage tenants.</p>
          </section>
          <section className="card">
            <h2>Menu</h2>
            <p>Items, modifiers, upsells.</p>
          </section>
          <section className="card">
            <h2>Tables</h2>
            <p>Floor layout + reservations.</p>
          </section>
          <section className="card">
            <h2>Orders</h2>
            <p>Realtime status + kitchen flow.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

