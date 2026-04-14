// RightPanel — stub for Task 1.
// Full room items + cart UI comes in Task 3.

export function RightPanel() {
  return (
    <aside id="items-panel">
      <div className="panel-header">
        <h3>Room Items</h3>
      </div>
      <div className="items-list" style={{ padding: '16px', color: 'var(--text-muted)', fontSize: '12px' }}>
        Room items — wired in Task 3
      </div>
      <div className="panel-footer">
        <div className="total">0 items placed</div>
        <div className="action-btns">
          <button className="footer-btn orange" disabled>Add All to Cart</button>
        </div>
      </div>
    </aside>
  )
}
