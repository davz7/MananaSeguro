import { useTranslation } from 'react-i18next'
import logoCompleto from '../../assets/LOGO_MS_orange.png'
import { socialLinks } from '../../data/socialLinks'

function Footer({ dark = false }) {
    const { t } = useTranslation()
    const year = new Date().getFullYear()

    return (
        <footer className={`${dark ? 'bg-bg border-white/8' : 'bg-cream dark:bg-bg border-ink/8 dark:border-white/8'} border-t py-8`}>
            <div className="container mx-auto px-4 flex flex-col gap-6">

                {/* Fila principal */}
                <div className="flex flex-wrap justify-between items-center gap-4">

                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <img src={logoCompleto} alt={t('nav.logoAlt')} className="h-8 w-auto rounded-lg" />
                        <span className="font-display font-bold text-lg text-white tracking-tight">
                            {t('nav.marca')} <span className="text-brand">{t('nav.marcaAccent')}</span>
                        </span>
                    </div>

                    {/* Redes sociales */}
                    <div className="flex items-center gap-3">
                        {socialLinks.map((link) => {
                            return (
                                <a
                                    key={link.labelKey}
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={t(link.labelKey)}
                                    className="text-gray dark:text-white/40 hover:text-brand dark:hover:text-brand transition-colors">
                                    {link.icon}
                                </a>
                            )
                        })}
                    </div>

                    {/* Créditos */}
                    <div className="flex flex-wrap items-center gap-2 text-sm text-gray dark:text-white/40">
                        <span>{t('footer.stellar')}</span>
                        <span className="text-ink/20 dark:text-white/20">·</span>
                        <span>{t('footer.etherfuse')}</span>
                        <span className="text-ink/20 dark:text-white/20">·</span>
                        <span>{t('footer.hackathon')}</span>
                    </div>

                </div>

                {/* Fila legal */}
                <div className="flex flex-wrap justify-between items-center gap-2 border-t border-ink/8 dark:border-white/8 pt-4 text-xs text-gray/60 dark:text-white/30">
                    <span>{t('footer.derechos', { year })}</span>
                    <div className="flex items-center gap-4">
                        <a href="/privacidad" className="hover:text-brand transition-colors">
                            {t('footer.privacidad')}
                        </a>
                        <a href="/terminos" className="hover:text-brand transition-colors">
                            {t('footer.terminos')}
                        </a>
                    </div>
                </div>

            </div>
        </footer>
    )
}

export default Footer
