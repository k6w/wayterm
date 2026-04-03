import { useState, useEffect } from 'react';
import { useDatabaseStore } from '../../stores/database';
import { DatabaseConnection } from '../../types/database';
import { Database, Plus, Play, Trash2, X, Check, RefreshCw } from 'lucide-react';

export function DatabasePanel() {
  const { connections, activeConnection, queryHistory, isConnected, isLoading, error, connect, disconnect, executeQuery, loadConnections, saveConnection, deleteConnection } = useDatabaseStore();
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [query, setQuery] = useState('');
  const [formData, setFormData] = useState<Partial<DatabaseConnection>>({
    name: '',
    type: 'postgresql',
    host: 'localhost',
    port: 5432,
    database: '',
    username: '',
    password: '',
    ssl: false,
  });

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const handleConnect = async (connection: DatabaseConnection) => {
    await connect(connection);
  };

  const handleDisconnect = async () => {
    await disconnect();
  };

  const handleExecuteQuery = async () => {
    if (query.trim() && activeConnection) {
      await executeQuery(query);
    }
  };

  const handleSaveConnection = async () => {
    if (formData.name && formData.host && formData.database && formData.username) {
      await saveConnection(formData as DatabaseConnection);
      setShowConnectionForm(false);
      setFormData({
        name: '',
        type: 'postgresql',
        host: 'localhost',
        port: 5432,
        database: '',
        username: '',
        password: '',
        ssl: false,
      });
      loadConnections();
    }
  };

  const handleDeleteConnection = async (id: string) => {
    await deleteConnection(id);
    loadConnections();
  };

  return (
    <div className="flex flex-col h-full text-text-primary">
      <div className="flex items-center justify-between p-3 border-b border-white/[0.08]">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          <span className="font-medium text-sm">Database Client</span>
        </div>
        <button
          onClick={() => setShowConnectionForm(!showConnectionForm)}
          className="p-1 hover:bg-white/[0.08] rounded transition-colors"
        >
          {showConnectionForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-error/20 text-error text-xs border-b border-white/[0.08]">
          {error}
        </div>
      )}

      {showConnectionForm && (
        <div className="p-3 border-b border-white/[0.08] space-y-2">
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Connection Name"
            className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
            className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-xs text-text-primary focus:outline-none focus:border-accent"
          >
            <option value="postgresql" className="bg-bg-primary text-text-primary">PostgreSQL</option>
            <option value="mysql" className="bg-bg-primary text-text-primary">MySQL</option>
            <option value="sqlite" className="bg-bg-primary text-text-primary">SQLite</option>
            <option value="mongodb" className="bg-bg-primary text-text-primary">MongoDB</option>
          </select>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={formData.host}
              onChange={(e) => setFormData({ ...formData, host: e.target.value })}
              placeholder="Host"
              className="px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
            <input
              type="number"
              value={formData.port}
              onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
              placeholder="Port"
              className="px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          <input
            type="text"
            value={formData.database}
            onChange={(e) => setFormData({ ...formData, database: e.target.value })}
            placeholder="Database"
            className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />

          <input
            type="text"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            placeholder="Username"
            className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />

          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Password"
            className="w-full px-2 py-1.5 bg-white/[0.05] border border-white/[0.08] rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />

          <label className="flex items-center gap-2 text-xs text-text-secondary">
            <input
              type="checkbox"
              checked={formData.ssl}
              onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
              className="rounded"
            />
            Use SSL
          </label>

          <button
            onClick={handleSaveConnection}
            className="w-full px-3 py-1.5 bg-accent text-white rounded text-xs hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
          >
            <Check className="w-3.5 h-3.5" />
            Save Connection
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {!isConnected ? (
          <div className="p-3 space-y-2">
            <div className="text-xs font-medium text-text-muted mb-2">Saved Connections</div>
            {connections.map(conn => (
              <div
                key={conn.id}
                className="p-2.5 bg-white/[0.03] rounded border border-white/[0.08] flex items-center justify-between hover:bg-white/[0.06] transition-colors"
              >
                <div className="flex-1 cursor-pointer" onClick={() => handleConnect(conn)}>
                  <div className="text-xs font-medium text-text-primary">{conn.name}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {conn.type} • {conn.host}:{conn.port} • {conn.database}
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteConnection(conn.id)}
                  className="p-1 hover:bg-error/20 rounded text-text-muted hover:text-error transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            {connections.length === 0 && (
              <div className="text-center text-text-muted py-12 text-xs">
                No saved connections
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="p-3 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-text-primary">{activeConnection?.name}</div>
                <div className="text-[10px] text-text-muted mt-0.5">
                  {activeConnection?.type} • {activeConnection?.database}
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="px-2.5 py-1 bg-error text-white rounded text-xs hover:opacity-80 transition-opacity"
              >
                Disconnect
              </button>
            </div>

            <div className="p-3 space-y-2">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter SQL query..."
                className="w-full p-2 bg-white/[0.05] border border-white/[0.08] rounded text-xs font-mono text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent"
                rows={6}
              />
              <button
                onClick={handleExecuteQuery}
                disabled={!query.trim() || isLoading}
                className="w-full px-3 py-1.5 bg-accent text-white rounded text-xs hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
              >
                {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                Execute Query
              </button>
            </div>

            {queryHistory.length > 0 && (
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="text-xs font-medium text-text-muted">Query History</div>
                {queryHistory.slice().reverse().map(item => (
                  <div key={item.id} className="p-2 bg-white/[0.03] rounded border border-white/[0.08] space-y-1">
                    <div className="text-[10px] font-mono text-text-secondary">{item.query}</div>
                    <div className="flex items-center justify-between text-[10px] text-text-muted">
                      <span>{new Date(item.timestamp).toLocaleString()}</span>
                      <span>{item.duration}ms</span>
                    </div>
                    {item.error && (
                      <div className="text-[10px] text-error">{item.error}</div>
                    )}
                    {item.rowCount !== undefined && (
                      <div className="text-[10px] text-success">{item.rowCount} rows</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
