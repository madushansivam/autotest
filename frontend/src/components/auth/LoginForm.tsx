import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../../lib/supabase';

export default function LoginForm() {
  return (
    <Auth
      supabaseClient={supabase}
      appearance={{
        theme: ThemeSupa,
        variables: {
          default: {
            colors: {
              brand: 'hsl(262 83% 66%)',
              brandAccent: 'hsl(262 70% 50%)',
              inputBackground: 'hsl(220 18% 12%)',
              inputBorder: 'hsl(220 14% 20%)',
              inputText: 'white',
              inputLabelText: 'hsl(220 14% 60%)',
            },
            borderWidths: { buttonBorderWidth: '1px', inputBorderWidth: '1px' },
            radii: { borderRadiusButton: '10px', inputBorderRadius: '10px' },
          },
        },
        className: {
          container: 'w-full',
          button:
            'w-full py-3 font-semibold transition-all duration-150 hover:opacity-90',
          label: 'text-sm font-medium',
          input: 'transition-all duration-150',
        },
      }}
      providers={[]}
      redirectTo={window.location.origin + '/'}
    />
  );
}
