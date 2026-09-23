import { useTheme } from '@/shared/theme/theme-context';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="icon-button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      title={isDark ? 'Modo claro' : 'Modo escuro'}
    >
      {isDark ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 4.5a1 1 0 0 1 1 1V7a1 1 0 1 1-2 0V5.5a1 1 0 0 1 1-1Zm0 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7.5-2.5a1 1 0 1 1 0 2H18a1 1 0 1 1 0-2h1.5ZM6 12a1 1 0 0 1-1 1H3.5a1 1 0 1 1 0-2H5a1 1 0 0 1 1 1Zm11.66 5.16a1 1 0 0 1 0 1.41l-1.06 1.06a1 1 0 1 1-1.41-1.41l1.06-1.06a1 1 0 0 1 1.41 0ZM8.81 6.37a1 1 0 0 1 0 1.41L7.75 8.84A1 1 0 0 1 6.34 7.43l1.06-1.06a1 1 0 0 1 1.41 0Zm8.85 0 1.06 1.06A1 1 0 0 1 17.3 8.84l-1.06-1.06a1 1 0 0 1 1.41-1.41ZM7.75 15.16l1.06 1.06a1 1 0 1 1-1.41 1.41L6.34 16.57a1 1 0 0 1 1.41-1.41ZM12 17a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V18a1 1 0 0 1 1-1Z"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path
            fill="currentColor"
            d="M13.1 3.05a1 1 0 0 1 1.17 1.28 7.5 7.5 0 1 0 5.4 5.4 1 1 0 0 1 1.28 1.17A9.5 9.5 0 1 1 13.1 3.05Z"
          />
        </svg>
      )}
    </button>
  );
};
