import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccessRestrictedProps {
  resourceName: string;
  requiredPermission?: string;
  message?: string;
}

export function AccessRestricted({ resourceName, requiredPermission, message }: AccessRestrictedProps) {
  const navigate = useNavigate();

  return (
    <div className="glass rounded-2xl p-10 card-glow flex flex-col items-center justify-center text-center py-16 max-w-lg mx-auto my-8 animate-fade-in border border-destructive/10">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mb-6 animate-pulse">
        <ShieldAlert className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">Access Restricted</h2>
      <p className="text-muted-foreground text-sm mb-6 leading-relaxed">
        {message || `You do not have the required permissions to view ${resourceName}.`}
      </p>
      {requiredPermission && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Required Permission</p>
          <div className="flex flex-wrap gap-1.5 justify-center">
            <span className="text-[10px] px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-mono">
              {requiredPermission}
            </span>
          </div>
        </div>
      )}
      <button
        onClick={() => navigate('/dashboard')}
        className="px-5 py-2.5 bg-primary hover:bg-primary/95 text-white font-semibold text-sm rounded-xl transition duration-200"
      >
        Return to Dashboard
      </button>
    </div>
  );
}
