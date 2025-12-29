import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mic, Lock, Mail, Check, X, Eye, EyeOff } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

// Password requirements for signup
const passwordRequirements = [
  { id: 'length', label: 'Mindestens 8 Zeichen', test: (pw: string) => pw.length >= 8 },
  { id: 'uppercase', label: 'Ein Großbuchstabe', test: (pw: string) => /[A-Z]/.test(pw) },
  { id: 'lowercase', label: 'Ein Kleinbuchstabe', test: (pw: string) => /[a-z]/.test(pw) },
  { id: 'number', label: 'Eine Zahl', test: (pw: string) => /[0-9]/.test(pw) },
  { id: 'special', label: 'Ein Sonderzeichen (!@#$%^&*)', test: (pw: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pw) },
];

// Login only needs basic validation
const loginSchema = z.object({
  email: z.string().trim().email({ message: 'Ungültige E-Mail-Adresse' }),
  password: z.string().min(1, { message: 'Passwort erforderlich' }),
});

// Signup requires strong password
const signupSchema = z.object({
  email: z.string().trim().email({ message: 'Ungültige E-Mail-Adresse' }),
  password: z.string()
    .min(8, { message: 'Passwort muss mindestens 8 Zeichen haben' })
    .regex(/[A-Z]/, { message: 'Passwort muss einen Großbuchstaben enthalten' })
    .regex(/[a-z]/, { message: 'Passwort muss einen Kleinbuchstaben enthalten' })
    .regex(/[0-9]/, { message: 'Passwort muss eine Zahl enthalten' })
    .regex(/[!@#$%^&*(),.?":{}|<>]/, { message: 'Passwort muss ein Sonderzeichen enthalten' }),
});

const emailSchema = z.string().trim().email({ message: 'Ungültige E-Mail-Adresse' });

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [resetError, setResetError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  
  const { signIn, signUp, resetPassword, isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated && !loading) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, loading, navigate, from]);

  // Calculate password strength for visual indicator
  const passwordStrength = useMemo(() => {
    const passed = passwordRequirements.filter(req => req.test(password)).length;
    return {
      score: passed,
      percentage: (passed / passwordRequirements.length) * 100,
      requirements: passwordRequirements.map(req => ({
        ...req,
        passed: req.test(password)
      }))
    };
  }, [password]);

  const getStrengthColor = (percentage: number) => {
    if (percentage <= 20) return 'bg-destructive';
    if (percentage <= 40) return 'bg-orange-500';
    if (percentage <= 60) return 'bg-yellow-500';
    if (percentage <= 80) return 'bg-lime-500';
    return 'bg-green-500';
  };

  const getStrengthLabel = (percentage: number) => {
    if (percentage <= 20) return 'Sehr schwach';
    if (percentage <= 40) return 'Schwach';
    if (percentage <= 60) return 'Mittel';
    if (percentage <= 80) return 'Stark';
    return 'Sehr stark';
  };

  const validateForm = (isSignup: boolean) => {
    const schema = isSignup ? signupSchema : loginSchema;
    const result = schema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.issues.forEach((issue) => {
        if (issue.path[0] === 'email') fieldErrors.email = issue.message;
        if (issue.path[0] === 'password') fieldErrors.password = issue.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(false)) return;
    
    setIsSubmitting(true);
    const { error } = await signIn(email, password);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        toast({
          title: 'Login fehlgeschlagen',
          description: 'E-Mail oder Passwort ist falsch.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Fehler',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm(true)) return;
    
    setIsSubmitting(true);
    const { error } = await signUp(email, password);
    setIsSubmitting(false);

    if (error) {
      if (error.message.includes('already registered')) {
        toast({
          title: 'Registrierung fehlgeschlagen',
          description: 'Diese E-Mail-Adresse ist bereits registriert.',
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Fehler',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Registrierung erfolgreich',
        description: 'Du kannst dich jetzt einloggen.',
      });
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const result = emailSchema.safeParse(resetEmail);
    if (!result.success) {
      setResetError(result.error.issues[0].message);
      return;
    }
    setResetError(null);
    
    setIsResetting(true);
    const { error } = await resetPassword(resetEmail);
    setIsResetting(false);

    if (error) {
      toast({
        title: 'Fehler',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'E-Mail gesendet',
        description: 'Prüfe dein Postfach für den Link zum Zurücksetzen deines Passworts.',
      });
      setResetDialogOpen(false);
      setResetEmail('');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-hero">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center gradient-hero p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20">
            <Mic className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">AI Meeting Recorder</h1>
        </div>

        <Card className="shadow-card border-border/50">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl">Willkommen</CardTitle>
            <CardDescription>
              Melde dich an oder erstelle ein neues Konto
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Anmelden</TabsTrigger>
                <TabsTrigger value="register">Registrieren</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">E-Mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="deine@email.de"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Passwort</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Anmelden...
                      </>
                    ) : (
                      'Anmelden'
                    )}
                  </Button>
                  
                  <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="link" type="button" className="w-full text-muted-foreground">
                        Passwort vergessen?
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                      <DialogHeader>
                        <DialogTitle>Passwort zurücksetzen</DialogTitle>
                        <DialogDescription>
                          Gib deine E-Mail-Adresse ein und wir senden dir einen Link zum Zurücksetzen deines Passworts.
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="reset-email">E-Mail</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                              id="reset-email"
                              type="email"
                              placeholder="deine@email.de"
                              value={resetEmail}
                              onChange={(e) => setResetEmail(e.target.value)}
                              className="pl-10"
                              disabled={isResetting}
                            />
                          </div>
                          {resetError && (
                            <p className="text-sm text-destructive">{resetError}</p>
                          )}
                        </div>
                        <Button type="submit" className="w-full" disabled={isResetting}>
                          {isResetting ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Senden...
                            </>
                          ) : (
                            'Link senden'
                          )}
                        </Button>
                      </form>
                    </DialogContent>
                  </Dialog>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-email">E-Mail</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-email"
                        type="email"
                        placeholder="deine@email.de"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        disabled={isSubmitting}
                      />
                    </div>
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Passwort</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="register-password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                    
                    {/* Password strength indicator */}
                    {password.length > 0 && (
                      <div className="space-y-2 mt-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Passwortstärke:</span>
                          <span className={`font-medium ${
                            passwordStrength.percentage <= 40 ? 'text-destructive' : 
                            passwordStrength.percentage <= 60 ? 'text-yellow-600' : 
                            'text-green-600'
                          }`}>
                            {getStrengthLabel(passwordStrength.percentage)}
                          </span>
                        </div>
                        <Progress 
                          value={passwordStrength.percentage} 
                          className="h-1.5"
                          indicatorClassName={getStrengthColor(passwordStrength.percentage)}
                        />
                        <ul className="space-y-1 mt-2">
                          {passwordStrength.requirements.map(req => (
                            <li 
                              key={req.id} 
                              className={`flex items-center gap-2 text-xs ${
                                req.passed ? 'text-green-600' : 'text-muted-foreground'
                              }`}
                            >
                              {req.passed ? (
                                <Check className="h-3 w-3" />
                              ) : (
                                <X className="h-3 w-3" />
                              )}
                              {req.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrieren...
                      </>
                    ) : (
                      'Konto erstellen'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
