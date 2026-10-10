import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import whiteLogo from '../assets/LOGO_MS_white.png'
import stellarLogo from '../assets/LOGO_Stellar.png'
import bafLogo from '../assets/LOGO_BAF.png'
import etherfuseLogo from '../assets/LOGO_Etherfuse.png'
import Footer from './components/Footer'
import { socialLinks } from '../data/socialLinks'
import LandingNavbar from './components/LandingNavbar'


const teamMembers = ['member1', 'member2', 'member3', 'member4', 'member5']

export function AboutScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()



  return (
    <div className="dark flex min-h-screen flex-col bg-[#100f0e] text-[#f4f0ec]">
      <LandingNavbar
        soloVolver
        onVolver={() => navigate(location.state?.from || '/main')}
      />

      <main className="mx-auto grid w-full max-w-[1240px] flex-1 items-center gap-10 px-5 py-10 sm:px-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-12">
        <section className="flex flex-col justify-center" aria-labelledby="about-promise">
          <h1 id="about-promise" className="max-w-[540px] text-[2.8rem] font-black leading-[1.12] sm:text-[3.8rem] lg:text-[4.3rem]">
            <span className="block">{t('about.promise1')} <span className="text-[#e97816]">{t('about.promiseAccent1')}</span></span>
            <span className="block">{t('about.promise2')} <span className="text-[#e97816]">{t('about.promiseAccent2')}</span></span>
            <span className="block">{t('about.promise3')} <span className="text-[#e97816]">{t('about.promiseAccent3')}</span></span>
          </h1>
        </section>

        <section className="w-full rounded-[24px] bg-white/[0.035] px-5 py-7 sm:px-8 sm:py-9" aria-labelledby="about-title">
          <h2 id="about-title" className="text-center text-[2rem] font-bold leading-tight sm:text-[2.4rem]">
            {t('about.title')}
          </h2>

          <div className="mt-5 flex flex-col items-center text-center">
            <span className="flex h-[76px] w-[76px] items-center justify-center rounded-[22px] bg-[#e97816]">
              <img src={whiteLogo} alt={t('nav.logoAlt')} className="h-12 w-12 object-contain" />
            </span>
            <p className="mt-3 text-sm font-semibold">{t('about.company')}</p>
            <p className="mt-5 text-xs text-white/45">{t('about.developedBy')}</p>
          </div>

          <ul className="mx-auto mt-3 grid max-w-[600px] grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-3" aria-label={t('about.teamTitle')}>
            {teamMembers.map((member) => (
              <li key={member} className="min-w-0 border-l border-[#e97816]/60 pl-2.5">
                <p className="break-words text-[0.78rem] leading-snug text-white/55">{t(`about.team.${member}.role`)}</p>
                <p className="mt-1 break-words text-xs font-semibold text-white/85">{t(`about.team.${member}.name`)}</p>
              </li>
            ))}
          </ul>

          <div className="mt-6 border-t border-white/10 pt-5">
            <h3 className="text-center text-sm font-medium text-white/70">{t('about.partners')}</h3>
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
              <div className="flex flex-col items-center gap-2 text-xs font-semibold text-white/80">
                <img src={stellarLogo} alt="" aria-hidden="true" className="h-12 w-24 object-contain" />
                <span>Stellar</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-xs font-semibold text-white/80">
                <img src={bafLogo} alt="" aria-hidden="true" className="h-12 w-24 object-contain" />
                <span>BAF</span>
              </div>
              <div className="flex flex-col items-center gap-2 text-xs font-semibold text-white/80">
                <img src={etherfuseLogo} alt="" aria-hidden="true" className="h-12 w-24 object-contain" />
                <span>Etherfuse</span>
              </div>
            </div>
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <h3 className="text-center text-sm font-medium text-white/70">{t('about.socialTitle')}</h3>
            <ul className="mt-3 flex flex-wrap justify-center gap-2.5">
              {socialLinks.map(({ icon, href, labelKey }) => {
                const label = t(labelKey)
                const isEmail = href.startsWith('mailto:')

                return (
                  <li key={labelKey}>
                    <a
                      href={href}
                      target={isEmail ? undefined : '_blank'}
                      rel={isEmail ? undefined : 'noopener noreferrer'}
                      aria-label={label}
                      title={label}
                      className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e97816] text-white transition hover:bg-[#f08727] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                    >
                      {icon}
                    </a>
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}