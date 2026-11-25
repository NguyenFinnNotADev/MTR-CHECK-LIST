import { useState } from 'react';
import { assetBase, iconUrl } from '../platform';

const PALETTE = ['#c9783f', '#5f9a45', '#3f7fd0', '#9b59b6', '#d9822b', '#16a085', '#c0392b', '#7f8c8d'];

export function Icon({ id, name, className = 'ico' }: { id: string; name: string; className?: string }) {
  const [broken, setBroken] = useState(id.startsWith('?') || id.startsWith('custom:'));
  if (broken) {
    let h = 0;
    for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return (
      <span className={`${className} fb`} style={{ background: PALETTE[h % PALETTE.length] }} aria-hidden>
        {name.trim()[0]?.toUpperCase() ?? '?'}
      </span>
    );
  }
  return <img className={className} src={iconUrl(id)} alt="" loading="lazy" onError={() => setBroken(true)} draggable={false} />;
}

export type UiIconName =
  | 'pick' | 'materials' | 'plan' | 'maps' | 'settings' | 'mini' | 'pin' | 'note' | 'raw' | 'history' | 'rename'
  | 'duplicate' | 'reset' | 'delete' | 'search' | 'main' | 'export' | 'import' | 'folder' | 'farm' | 'owned' | 'nofarm'
  | 'done' | 'missing' | 'sort' | 'warning' | 'location' | 'group' | 'theme' | 'language' | 'animation' | 'close'
  | 'add' | 'pickaxe' | 'nonfarm' | 'unknown' | 'build' | 'menu';

/** Pixel-art UI icon (flat Minecraft item sprite from icons/ui). */
export function UiIcon({ name, size = 18, className = '' }: { name: UiIconName; size?: number; className?: string }) {
  return <img className={`ui-ico ${className}`} src={`${assetBase}icons/ui/${name}.png`} width={size} height={size} alt="" draggable={false} />;
}

export function Slot({ id, name }: { id: string; name: string }) {
  return <div className="slot"><Icon id={id} name={name} /></div>;
}
