import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDatabaseStore } from '../../stores/database';
import type { DatabaseConnection, QueryResult } from '../../types/database';
import { Database, Plus, Play, Trash2, X, Check, RefreshCw, Clock, FileJson, FileText } from 'lucide-react';

export function DatabasePanel() {
  const { connections, activeConnection, queryHistory, isConnected, isLoading, connect, disconnect, executeQuery, loadConnections, saveConnection, deleteConnection } = useDatabaseStore();
  const [showConnectionForm, setShowConnectionForm] = useState(false);
  const [query, setQuery] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [historyDropdownOpen, setHistoryDropdownOpen] = useState(false);
  const historyIndexRef = useRef(-1);
  const historyDropdownRef = useRef<HTMLDivElement>(null);
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

  // Close history dropdown on outside click
  useEffect(() => {
    if (!historyDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (historyDropdownRef.current && !historyDropdownRef.current.contains(e.target as Node)) {
        setHistoryDropdownOpen(false);
      }
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [historyDropdownOpen]);

  const historyQueries = queryHistory.map((h) => h.query);

  const handleTextareaKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (historyQueries.length === 0) return;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextIdx = Math.min(historyIndexRef.current + 1, historyQueries.length - 1);
      historyIndexRef.current = nextIdx;
      setQuery(historyQueries[nextIdx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndexRef.current <= 0) {
        historyIndexRef.current = -1;
        setQuery('');
      } else {
        const nextIdx = historyIndexRef.current - 1;
        historyIndexRef.current = nextIdx;
        setQuery(historyQueries[nextIdx]);
      }
    } else {
      // Reset history navigation on other keypresses
      historyIndexRef.current = -1;
    }
  }, [historyQueries]);

  const handleConnect = async (conn: DatabaseConnection) => {
    await connect(conn.id);
  };

  const handleDisconnect = async () => {
    await disconnect();
    setQueryResult(null);
  };

  const handleExecuteQuery = async () => {
    if (query.trim() && activeConnection) {
      historyIndexRef.current = -1;
      try {
        const result = await executeQuery(query);
        setQueryResult(result);
      } catch {
        setQueryResult(null);
      }
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

  const handleRestoreQuery = (q: string) => {
    setQuery(q);
    historyIndexRef.current = -1;
    setHistoryDropdownOpen(false);
  };

  const exportCsv = () => {
    if (!queryResult || queryResult.columns.length === 0) return;
    const header = queryResult.columns.join(',');
    const rows = queryResult.rows.map((row) =>
      queryResult.columns.map((col) => {
        const val = (row as Record<string, unknown>)[col];
        const str = val == null ? '' : String(val);
        // Escape quotes and wrap in quotes if needed
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-results.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    if (!queryResult || queryResult.rows.length === 0) return;
    const json = JSON.stringify(queryResult.rows, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'query-results.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full text-text-primary">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4" />
          <span className="font-medium text-sm">Database Client</span>
        </div>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 90 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowConnectionForm(!showConnectionForm)}
          className="p-1 hover:bg-overlay/[0.08] rounded transition-colors"
        >
          {showConnectionForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
        </motion.button>
      </div>

      <AnimatePresence>
        {showConnectionForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="p-3 border-b border-border space-y-2 overflow-hidden"
          >
            <motion.input
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.05 }}
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Connection Name"
              className="w-full px-2 py-1.5 bg-overlay/[0.05] border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />

            <motion.select
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as DatabaseConnection['type'] })}
              className="w-full px-2 py-1.5 bg-overlay/[0.05] border border-border rounded text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="postgresql" className="bg-bg-primary text-text-primary">PostgreSQL</option>
              <option value="mysql" className="bg-bg-primary text-text-primary">MySQL</option>
              <option value="sqlite" className="bg-bg-primary text-text-primary">SQLite</option>
              <option value="mongodb" className="bg-bg-primary text-text-primary">MongoDB</option>
            </motion.select>

            <motion.div
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="grid grid-cols-2 gap-2"
            >
              <input
                type="text"
                value={formData.host}
                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                placeholder="Host"
                className="px-2 py-1.5 bg-overlay/[0.05] border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
              <input
                type="number"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                placeholder="Port"
                className="px-2 py-1.5 bg-overlay/[0.05] border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
              />
            </motion.div>

            <motion.input
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              type="text"
              value={formData.database}
              onChange={(e) => setFormData({ ...formData, database: e.target.value })}
              placeholder="Database"
              className="w-full px-2 py-1.5 bg-overlay/[0.05] border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />

            <motion.input
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              placeholder="Username"
              className="w-full px-2 py-1.5 bg-overlay/[0.05] border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />

            <motion.input
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Password"
              className="w-full px-2 py-1.5 bg-overlay/[0.05] border border-border rounded text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
            />

            <motion.label
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.35 }}
              className="flex items-center gap-2 text-xs text-text-secondary"
            >
              <input
                type="checkbox"
                checked={formData.ssl}
                onChange={(e) => setFormData({ ...formData, ssl: e.target.checked })}
                className="rounded"
              />
              Use SSL
            </motion.label>

            <motion.button
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSaveConnection}
              className="w-full px-3 py-1.5 bg-accent text-white rounded text-xs hover:opacity-80 transition-opacity flex items-center justify-center gap-2"
            >
              <Check className="w-3.5 h-3.5" />
              Save Connection
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {!isConnected ? (
            <motion.div
              key="connections"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-3 space-y-2"
            >
              <div className="text-xs font-medium text-text-muted mb-2">Saved Connections</div>
              {connections.map((conn, i) => (
                <motion.div
                  key={conn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ scale: 1.02, x: 4 }}
                  className="p-2.5 bg-overlay/[0.03] rounded border border-border flex items-center justify-between hover:bg-overlay/[0.06] transition-colors"
                >
                  <div className="flex-1 cursor-pointer" onClick={() => handleConnect(conn)}>
                    <div className="text-xs font-medium text-text-primary">{conn.name}</div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {conn.type} • {conn.host}:{conn.port} • {conn.database}
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.2 }}
                    whileTap={{ scale: 0.8 }}
                    onClick={() => handleDeleteConnection(conn.id)}
                    className="p-1 hover:bg-error/20 rounded text-text-muted hover:text-error transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </motion.button>
                </motion.div>
              ))}
              {connections.length === 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-text-muted py-12 text-xs"
                >
                  No saved connections
                </motion.div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="query"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full"
            >
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="p-3 bg-overlay/[0.03] border-b border-border flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-medium text-text-primary">{activeConnection?.name}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">
                    {activeConnection?.type} • {activeConnection?.database}
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleDisconnect}
                  className="px-2.5 py-1 bg-error text-white rounded text-xs hover:opacity-80 transition-opacity"
                >
                  Disconnect
                </motion.button>
              </motion.div>

              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className="p-3 space-y-2"
              >
                <div className="relative">
                  <textarea
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); historyIndexRef.current = -1; }}
                    onKeyDown={handleTextareaKeyDown}
                    placeholder="Enter SQL query... (↑/↓ for history)"
                    className="w-full p-2 bg-overlay/[0.05] border border-border rounded text-xs font-mono text-text-primary placeholder:text-text-muted resize-none focus:outline-none focus:border-accent"
                    rows={6}
                  />
                  {/* History dropdown button */}
                  {queryHistory.length > 0 && (
                    <div ref={historyDropdownRef} className="absolute top-1.5 right-1.5">
                      <button
                        type="button"
                        onClick={() => setHistoryDropdownOpen((p) => !p)}
                        className="flex items-center justify-center w-5 h-5 rounded text-text-muted hover:text-text-secondary hover:bg-overlay/[0.08] transition-colors"
                        title="Query history"
                      >
                        <Clock className="w-3 h-3" />
                      </button>
                      {historyDropdownOpen && (
                        <div className="absolute right-0 top-full mt-1 z-50 w-[280px] rounded-lg border border-border bg-bg-secondary shadow-xl overflow-hidden">
                          <div className="py-1 max-h-[240px] overflow-y-auto">
                            {queryHistory.map((item) => (
                              <button
                                key={item.id}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-overlay/[0.06] transition-colors"
                                onClick={() => handleRestoreQuery(item.query)}
                              >
                                <div className="text-[10px] font-mono text-text-secondary truncate">{item.query}</div>
                                <div className="text-[9px] text-text-muted mt-0.5">
                                  {new Date(item.timestamp).toLocaleString()} • {item.duration}ms
                                  {item.error && <span className="text-error ml-1">error</span>}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleExecuteQuery}
                  disabled={!query.trim() || isLoading}
                  className="w-full px-3 py-1.5 bg-accent text-white rounded text-xs hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
                >
                  {isLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                  Execute Query
                </motion.button>
              </motion.div>

              {/* Query results */}
              <AnimatePresence>
                {queryResult && !queryResult.error && queryResult.rows.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col border-t border-border overflow-hidden"
                    style={{ maxHeight: '220px' }}
                  >
                    <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
                      <span className="text-[10px] text-text-muted">{queryResult.rowCount} rows</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={exportCsv}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-text-secondary hover:bg-overlay/[0.06] transition-colors"
                          title="Export CSV"
                        >
                          <FileText className="w-3 h-3" />
                          CSV
                        </button>
                        <button
                          onClick={exportJson}
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] text-text-muted hover:text-text-secondary hover:bg-overlay/[0.06] transition-colors"
                          title="Export JSON"
                        >
                          <FileJson className="w-3 h-3" />
                          JSON
                        </button>
                      </div>
                    </div>
                    <div className="overflow-auto flex-1">
                      <table className="w-full text-[10px] font-mono border-collapse">
                        <thead>
                          <tr className="sticky top-0 bg-bg-secondary">
                            {queryResult.columns.map((col) => (
                              <th key={col} className="px-2 py-1 text-left text-text-muted border-b border-border whitespace-nowrap">
                                {col}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {queryResult.rows.map((row, i) => (
                            <tr key={i} className="hover:bg-overlay/[0.03]">
                              {queryResult.columns.map((col) => (
                                <td key={col} className="px-2 py-0.5 text-text-secondary border-b border-border whitespace-nowrap max-w-[120px] truncate">
                                  {String((row as Record<string, unknown>)[col] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {queryHistory.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex-1 overflow-y-auto p-3 space-y-2 border-t border-border"
                  >
                    <div className="text-xs font-medium text-text-muted">Query History</div>
                    {queryHistory.slice().map((item, i) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        whileHover={{ scale: 1.01 }}
                        className="p-2 bg-overlay/[0.03] rounded border border-border space-y-1 cursor-pointer hover:bg-overlay/[0.06] transition-colors"
                        onClick={() => handleRestoreQuery(item.query)}
                      >
                        <div className="text-[10px] font-mono text-text-secondary">{item.query}</div>
                        <div className="flex items-center justify-between text-[10px] text-text-muted">
                          <span>{new Date(item.timestamp).toLocaleString()}</span>
                          <span>{item.duration}ms</span>
                        </div>
                        {item.error && (
                          <div className="text-[10px] text-error">{item.error}</div>
                        )}
                        {item.rowCount !== undefined && !item.error && (
                          <div className="text-[10px] text-success">{item.rowCount} rows</div>
                        )}
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
