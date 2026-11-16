import React, { useEffect, useState } from 'react';
import { WifiOff, Database, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { storageService } from '../services/storageService';

export const OfflineIndicator: React.FC = () => {
  const { isOnline, lastRevalidatedAt } = useOnlineStatus();
  const [showRevalidatedToast, setShowRevalidatedToast] = useState(false);
  const [idbMeta, setIdbMeta] = useState<{
    lastUpdatedAt: string | null;
    pendingOfflineMutations: number;
  }>({
    lastUpdatedAt: null,
    pendingOfflineMutations: 0,
  });

  useEffect(() => {
    let mounted = true;
    storageService.getOfflineCacheStatus().then((status) => {
      if (mounted) {
        setIdbMeta({
          lastUpdatedAt: status.lastUpdatedAt,
          pendingOfflineMutations: status.pendingOfflineMutations,
        });
      }
    });

    const handleStatusUpdate = () => {
      storageService.getOfflineCacheStatus().then((status) => {
        if (mounted) {
          setIdbMeta({
            lastUpdatedAt: status.lastUpdatedAt,
            pendingOfflineMutations: status.pendingOfflineMutations,
          });
        }
      });
    };

    window.addEventListener('studyflow:idb-swr-updated', handleStatusUpdate);
    return () => {
      mounted = false;
      window.removeEventListener('studyflow:idb-swr-updated', handleStatusUpdate);
    };
  }, [isOnline]);

  useEffect(() => {
    if (isOnline && lastRevalidatedAt) {
      setShowRevalidatedToast(true);
      const timer = window.setTimeout(() => setShowRevalidatedToast(false), 4500);
      return () => window.clearTimeout(timer);
    }
  }, [isOnline, lastRevalidatedAt]);

  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/95 backdrop-blur-xs px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-amber-400/40"
      >
        <span className="h-2 w-2 rounded-full bg-white animate-pulse shrink-0" />
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <div className="flex flex-col">
          <span>Modo Offline Activo · Workbox SWR + IndexedDB</span>
          <span className="text-[10px] font-normal text-amber-100 flex items-center gap-1">
            <Database className="w-3 h-3 inline" />
            Datos críticos servidos y guardados localmente en IndexedDB
            {idbMeta.pendingOfflineMutations > 0
              ? ` (${idbMeta.pendingOfflineMutations} cambios en cola)`
              : ''}
          </span>
        </div>
      </div>
    );
  }

  if (showRevalidatedToast) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-emerald-700/95 backdrop-blur-xs px-3.5 py-2 text-xs font-semibold text-white shadow-lg border border-emerald-500/40"
      >
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-200" />
        <span>
          Conexión restablecida · Caché SWR e IndexedDB revalidados ({lastRevalidatedAt})
        </span>
      </div>
    );
  }

  return null;
};
