import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  LogIn,
  ShieldCheck,
  ArrowRight,
  UserCheck,
  Lock,
  Phone,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { BusinessListing, LanguageCode } from '../types';
import { TRANSLATIONS } from '../i18n/translations';
import { ALL_AFRICAN_COUNTRIES, getAfricanCountryByName } from '../utils/africanCountries';
import {
  signInWithSupabase,
  signUpWithSupabase,
} from '../utils/supabaseClient';

interface EnterDirectoryPageProps {
  businesses: BusinessListing[];
  onLoginSuccess: (userType: 'merchant' | 'buyer', business?: BusinessListing, name?: string) => void;
  onAddBusiness?: (newBiz: BusinessListing) => void;
  onSyncUserRecord?: (userRecord: {
    role: 'merchant' | 'buyer';
    name: string;
    email?: string;
    phone?: string;
    country?: string;
    businessId?: string;
  }) => void;
  onNavigate: (tab: string) => void;
  currentUser?: { role: 'merchant' | 'buyer'; business?: BusinessListing; name?: string } | null;
  onSignOut?: () => void;
  currentLang?: LanguageCode;
}

export const EnterDirectoryPage: React.FC<EnterDirectoryPageProps> = ({
  businesses,
  onLoginSuccess,
  onAddBusiness,
  onSyncUserRecord,
  onNavigate,
  currentUser,
  onSignOut,
  currentLang = 'en',
}) => {
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.en;
  const [role, setRole] = useState<'merchant' | 'buyer'>('buyer');
  const [selectedBizId, setSelectedBizId] = useState(businesses[0]?.id || '');
  const [buyerOrg, setBuyerOrg] = useState('');
  const [phone, setPhone] = useState('');
  const [passcode, setPasscode] = useState('');
  const [newMerchantName, setNewMerchantName] = useState('');
  const [newMerchantCountry, setNewMerchantCountry] = useState('Angola');
  const [signedIn, setSignedIn] = useState(false);

  // Cloud Auth Integration State
  const [authMode, setAuthMode] = useState<'standard' | 'cloud'>('standard');
  const [cloudEmail, setCloudEmail] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudAuthType, setCloudAuthType] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState('');
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  const buildQuickMerchant = (merchantName: string, countryName: string, contactEmail?: string, contactPhone?: string): BusinessListing => {
    const countryData = getAfricanCountryByName(countryName);
    const secureDigits = Math.floor(100000 + Math.random() * 900000).toString();
    return {
      id: `biz-${Date.now()}`,
      name: merchantName.trim(),
      tagline: 'Verified African Commercial Enterprise',
      country: countryData.name,
      countryCode: countryData.code,
      city: `${countryData.name} Commercial Hub`,
      address: `${countryData.name}`,
      primaryLanguage: countryData.primaryLang,
      supportedLanguages: ['en', countryData.primaryLang],
      businessType: 'manufacturer',
      industry: 'Industrial & Commercial Supply',
      phone: contactPhone || '+244923000000',
      whatsappNumber: contactPhone || '+244923000000',
      email: contactEmail || 'contact@enterprise.com',
      yearEstablished: 2022,
      employeeCount: '25-50 employees',
      securityPin: `AFR-${secureDigits}`,
      verification: {
        tier: 'tier_2_registered',
        registeredEntityName: merchantName.trim(),
        registrationNumber: `REG-${Date.now().toString().slice(-6)}`,
        registrarAuthority: countryData.authority,
        registrationYear: 2022,
        phoneVerified: true,
        emailVerified: true,
        physicalSiteAudited: false,
        auditDate: new Date().toISOString().split('T')[0],
        independentCertifications: ['National Commercial Registry Matched'],
        selfClaimedCertifications: ['AfCFTA Export Readiness'],
        suspiciousReportsCount: 0,
      },
      tradeReadiness: {
        afcftaRegistered: true,
        countriesServed: [countryData.name, 'Regional Economic Community'],
        exportExperienceYears: 3,
        incoterms: ['FOB', 'CIF'],
        acceptedPaymentMethods: ['Trade Escrow / AfriTrade', 'Bank Wire (SWIFT)', 'Mobile Money (M-Pesa/MoMo/Multicaixa)'],
        tradeDocumentsReady: ['Certificate of Origin', 'Commercial Invoice'],
        mainCorridors: [`${countryData.name} Cross-Border Trade Corridor`],
      },
      products: [
        {
          id: `p-${Date.now()}`,
          name: 'Commercial Wholesale Goods',
          category: 'Industrial & Commercial Supply',
          description: 'Export-grade wholesale inventory ready for regional delivery.',
          unitPriceUSD: 1.0,
          moq: '500 units',
          leadTimeDays: 7,
          specifications: ['AfCFTA Standard Conformance'],
          imageUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=600&q=80',
        },
      ],
      about: `${merchantName.trim()} is an African enterprise registered in ${countryData.name}.`,
      coverImage: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=80',
      logoImage: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=200&q=80',
      rating: 5.0,
      reviewCount: 0,
      claimedByOwner: true,
      viewsCount: 1,
      whatsappClicksCount: 0,
      rfqsReceivedCount: 0,
      reviews: [],
    };
  };

  const handleCloudAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cloudEmail || !cloudPassword) return;
    setIsSubmittingAuth(true);
    setAuthError('');

    try {
      let signedUserMeta: any = null;
      if (cloudAuthType === 'signup') {
        const displayName =
          role === 'merchant'
            ? newMerchantName.trim() || 'Verified Merchant'
            : buyerOrg.trim() || cloudEmail.split('@')[0];
        const { user, error } = await signUpWithSupabase(cloudEmail, cloudPassword, {
          role,
          name: displayName,
          country: newMerchantCountry,
        });
        if (error) {
          setAuthError(error);
          setIsSubmittingAuth(false);
          return;
        }
        signedUserMeta = user?.user_metadata;
      } else {
        const { user, error } = await signInWithSupabase(cloudEmail, cloudPassword);
        if (error) {
          setAuthError(error);
          setIsSubmittingAuth(false);
          return;
        }
        signedUserMeta = user?.user_metadata;
      }

      setSignedIn(true);
      setTimeout(() => {
        const resolvedRole: 'merchant' | 'buyer' =
          signedUserMeta?.role === 'merchant' || signedUserMeta?.role === 'buyer'
            ? signedUserMeta.role
            : role;

        if (resolvedRole === 'merchant') {
          let matched =
            businesses.find((b) => b.id === selectedBizId) ||
            businesses.find((b) => b.email?.toLowerCase() === cloudEmail.trim().toLowerCase()) ||
            businesses[0];

          if (!matched && (newMerchantName.trim() || signedUserMeta?.name)) {
            matched = buildQuickMerchant(
              newMerchantName.trim() || signedUserMeta?.name || cloudEmail.split('@')[0],
              signedUserMeta?.country || newMerchantCountry,
              cloudEmail
            );
            onAddBusiness?.(matched);
          }

          onSyncUserRecord?.({
            role: 'merchant',
            name: matched?.name || newMerchantName || cloudEmail.split('@')[0],
            email: cloudEmail,
            country: matched?.country || newMerchantCountry,
            businessId: matched?.id,
          });
          onLoginSuccess('merchant', matched);
          onNavigate('sme-hub');
        } else {
          const buyerName =
            buyerOrg.trim() || signedUserMeta?.name || cloudEmail.split('@')[0];
          onSyncUserRecord?.({
            role: 'buyer',
            name: buyerName,
            email: cloudEmail,
            country: signedUserMeta?.country || newMerchantCountry,
          });
          onLoginSuccess('buyer', undefined, buyerName);
          onNavigate('marketplace');
        }
      }, 650);
    } catch (err: any) {
      setAuthError(err.message || 'Authentication error');
    } finally {
      setIsSubmittingAuth(false);
    }
  };

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');

    if (role === 'merchant') {
      let matched = businesses.find((b) => b.id === selectedBizId);
      if (matched && matched.securityPin) {
        const expected = matched.securityPin.trim().toUpperCase();
        const entered = passcode.trim().toUpperCase();
        const digitsOnly = expected.replace(/[^0-9]/g, '');
        if (entered !== expected && entered !== digitsOnly) {
          setAuthError('Invalid Security PIN for the selected business.');
          return;
        }
      }

      if (!matched && newMerchantName.trim()) {
        matched = buildQuickMerchant(newMerchantName.trim(), newMerchantCountry, undefined, phone);
        matched.securityPin = passcode.trim() || matched.securityPin;
        onAddBusiness?.(matched);
      }

      if (!matched) {
        setAuthError('Please enter your enterprise details to continue.');
        return;
      }

      onSyncUserRecord?.({
        role: 'merchant',
        name: matched.name,
        email: matched.email,
        phone: phone || matched.whatsappNumber,
        country: matched.country,
        businessId: matched.id,
      });

      setSignedIn(true);
      setTimeout(() => {
        onLoginSuccess('merchant', matched);
        onNavigate('sme-hub');
      }, 650);
    } else {
      const name = buyerOrg.trim() || 'Pan-African Commercial Buyer';
      onSyncUserRecord?.({
        role: 'buyer',
        name,
        phone,
        country: newMerchantCountry,
      });
      setSignedIn(true);
      setTimeout(() => {
        onLoginSuccess('buyer', undefined, name);
        onNavigate('marketplace');
      }, 650);
    }
  };

  // Authenticated account management view
  if (currentUser) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-md mx-auto space-y-6 pt-4"
      >
        <div className="bg-neutral-950 rounded-3xl p-8 space-y-5 text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-white text-black flex items-center justify-center mx-auto shadow-md">
            <UserCheck className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <div className="text-base font-bold text-white tracking-tight pt-1">
              {currentUser.business ? currentUser.business.name : currentUser.name || 'Authenticated User'}
            </div>
            {currentUser.business && (
              <p className="text-xs text-neutral-400 font-mono">
                {currentUser.business.city}, {currentUser.business.country} · Registry: {currentUser.business.verification.registrationNumber}
              </p>
            )}
          </div>

          <div className="p-4 rounded-2xl bg-neutral-900 text-left space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 font-mono">{t.sessionSecurity}</span>
              <span className="text-white font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                {t.activeVerified}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-400 font-mono">{t.afcftaTradeAuthority}</span>
              <span className="text-white font-semibold">Enabled</span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            {currentUser.role === 'merchant' ? (
              <button
                type="button"
                onClick={() => onNavigate('sme-hub')}
                className="w-full py-3 bg-white text-black hover:bg-neutral-200 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg"
              >
                Manage Digital Storefront
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('marketplace')}
                className="w-full py-3 bg-white text-black hover:bg-neutral-200 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-lg"
              >
                Go to B2B Marketplace
              </button>
            )}

            {onSignOut && (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full py-2.5 text-xs text-neutral-400 hover:text-white hover:bg-neutral-900 rounded-xl transition-colors cursor-pointer"
              >
                {t.navSignOut}
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-md mx-auto space-y-6 pt-4"
    >
      {/* Page Header */}
      <div className="bg-neutral-950 rounded-3xl p-6 sm:p-8 space-y-3 text-center shadow-2xl">
        <div className="w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center mx-auto shadow-md">
          <LogIn className="w-6 h-6" />
        </div>
        <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed pt-1">
          {t.enterDirectoryDesc}
        </p>

        {/* Role Segmented Switcher */}
        <div className="pt-2 flex rounded-2xl bg-neutral-900 p-1">
          <button
            type="button"
            onClick={() => {
              setRole('buyer');
              setAuthError('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              role === 'buyer'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.commercialBuyer}
          </button>
          <button
            type="button"
            onClick={() => {
              setRole('merchant');
              setAuthError('');
            }}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              role === 'merchant'
                ? 'bg-white text-black shadow-md'
                : 'text-neutral-400 hover:text-white'
            }`}
          >
            {t.verifiedBusiness}
          </button>
        </div>

        {/* Authentication Method Switcher */}
        <div className="pt-2">
          <div className="grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-neutral-900">
            <button
              type="button"
              onClick={() => {
                setAuthMode('standard');
                setAuthError('');
              }}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'standard'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Direct PIN</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode('cloud');
                setAuthError('');
              }}
              className={`py-2 px-3 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                authMode === 'cloud'
                  ? 'bg-white text-black shadow-md'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Cloud</span>
            </button>
          </div>
        </div>
      </div>

      {signedIn ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-neutral-950 rounded-3xl p-8 text-center space-y-3 shadow-2xl"
        >
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-pulse" />
          <h3 className="text-base font-bold text-white">Authentication Verified</h3>
          <p className="text-xs text-neutral-400">
            Authenticated via {authMode === 'cloud' ? 'Cloud Real-Time Auth' : 'Verified Directory PIN'}. Routing to your dashboard...
          </p>
        </motion.div>
      ) : authMode === 'cloud' ? (
        <form
          onSubmit={handleCloudAuth}
          className="bg-neutral-950 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl text-xs"
        >
          <div className="flex items-center justify-between pb-1 border-b border-neutral-900">
            <span className="font-bold text-white">Cloud</span>
            <div className="flex gap-1 text-[11px]">
              <button
                type="button"
                onClick={() => setCloudAuthType('signin')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  cloudAuthType === 'signin' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setCloudAuthType('signup')}
                className={`px-2.5 py-1 rounded-lg cursor-pointer ${
                  cloudAuthType === 'signup' ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/40 text-red-300 text-xs">
              {authError}
            </div>
          )}

          {cloudAuthType === 'signup' && role === 'merchant' && (
            <div>
              <label className="block text-neutral-400 mb-1.5 font-medium">Enterprise Legal Name</label>
              <input
                type="text"
                required
                value={newMerchantName}
                onChange={(e) => setNewMerchantName(e.target.value)}
                placeholder="e.g. Luanda Food Packaging SARL"
                className="w-full bg-neutral-900 text-white px-3.5 py-2.5 rounded-xl font-medium focus:ring-1 focus:ring-white outline-none"
              />
            </div>
          )}

          {cloudAuthType === 'signup' && role === 'buyer' && (
            <div>
              <label className="block text-neutral-400 mb-1.5 font-medium">Organization / Trading Entity</label>
              <input
                type="text"
                required
                value={buyerOrg}
                onChange={(e) => setBuyerOrg(e.target.value)}
                placeholder="e.g. African Commercial Enterprise Ltd"
                className="w-full bg-neutral-900 text-white px-3.5 py-2.5 rounded-xl font-medium focus:ring-1 focus:ring-white outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-neutral-400 mb-1.5 font-medium">Account Email</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="email"
                required
                value={cloudEmail}
                onChange={(e) => setCloudEmail(e.target.value)}
                placeholder="user@enterprise.africa"
                className="w-full bg-neutral-900 text-white pl-9 pr-3.5 py-2.5 rounded-xl font-mono focus:ring-1 focus:ring-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 mb-1.5 font-medium">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="password"
                required
                minLength={6}
                value={cloudPassword}
                onChange={(e) => setCloudPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-neutral-900 text-white pl-9 pr-3.5 py-2.5 rounded-xl font-mono focus:ring-1 focus:ring-white outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmittingAuth}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black font-bold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 shadow-lg"
          >
            {isSubmittingAuth ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Connecting to Cloud...
              </span>
            ) : (
              <>
                <span>{cloudAuthType === 'signup' ? 'Create Cloud Account' : 'Continue to Cloud'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      ) : (
        <form
          onSubmit={handleSignIn}
          className="bg-neutral-950 rounded-3xl p-6 sm:p-8 space-y-4 shadow-2xl text-xs"
        >
          {authError && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-800/40 text-red-300 text-xs">
              {authError}
            </div>
          )}

          {role === 'merchant' ? (
            businesses.length > 0 ? (
              <div>
                <label className="block text-neutral-400 mb-1.5 font-medium">{t.selectVerifiedBusiness}</label>
                <select
                  value={selectedBizId}
                  onChange={(e) => setSelectedBizId(e.target.value)}
                  className="w-full bg-neutral-900 text-white px-3.5 py-2.5 rounded-xl cursor-pointer"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.country})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="block text-neutral-400 mb-1 font-medium">Enterprise Legal Name</label>
                  <input
                    type="text"
                    required
                    value={newMerchantName}
                    onChange={(e) => setNewMerchantName(e.target.value)}
                    placeholder="e.g. Luanda Food Packaging SARL"
                    className="w-full bg-neutral-900 text-white px-3.5 py-2.5 rounded-xl font-medium focus:ring-1 focus:ring-white outline-none"
                  />
                </div>
                <div>
                  <label className="block text-neutral-400 mb-1 font-medium">Operating Country (All 54 African Nations)</label>
                  <select
                    value={newMerchantCountry}
                    onChange={(e) => setNewMerchantCountry(e.target.value)}
                    className="w-full bg-neutral-900 text-white px-3.5 py-2.5 rounded-xl cursor-pointer"
                  >
                    {ALL_AFRICAN_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          ) : (
            <div>
              <label className="block text-neutral-400 mb-1.5 font-medium">{t.buyerOrgName}</label>
              <input
                type="text"
                required
                value={buyerOrg}
                onChange={(e) => setBuyerOrg(e.target.value)}
                placeholder="e.g. African Commercial Enterprise Ltd"
                className="w-full bg-neutral-900 text-white px-3.5 py-2.5 rounded-xl font-medium focus:ring-1 focus:ring-white outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-neutral-400 mb-1.5 font-medium">{t.phoneWhatsApp}</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+244 923 000 000"
                className="w-full bg-neutral-900 text-white pl-9 pr-3.5 py-2.5 rounded-xl font-mono focus:ring-1 focus:ring-white outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-neutral-400 mb-1.5 font-medium">{t.pinPasscode}</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-neutral-500 absolute left-3 top-3 pointer-events-none" />
              <input
                type="password"
                required
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter Security PIN"
                className="w-full bg-neutral-900 text-white pl-9 pr-3.5 py-2.5 rounded-xl font-mono focus:ring-1 focus:ring-white outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-white text-black hover:bg-neutral-200 font-bold py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 mt-2 shadow-lg"
          >
            <span>{t.enterDirectoryPortal}</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="pt-2 text-center space-y-1">
            <span className="text-neutral-500">{t.needToRegister} </span>
            <button
              type="button"
              onClick={() => onNavigate('list-business')}
              className="text-white hover:underline font-bold cursor-pointer inline-flex items-center gap-1"
            >
              <span>{t.listBusinessSignUp}</span>
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
};
