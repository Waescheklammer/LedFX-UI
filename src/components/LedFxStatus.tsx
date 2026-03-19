import React, { useEffect, useState } from 'react';
import { getLedFxStatus } from '../api/ledfxClient';

export const LedFxStatus: React.FC = () => {
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getLedFxStatus()
      .then(setStatus)
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <div>Fehler: {error}</div>;
  if (!status) return <div>Lade Status...</div>;

  return (
    <div>
      <h2>LedFx Status</h2>
      <pre>{JSON.stringify(status, null, 2)}</pre>
    </div>
  );
};
