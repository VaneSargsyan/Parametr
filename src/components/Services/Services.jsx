
import styles from './Services.module.css'


export const Services = () => {
  
    return (
        <section id="services" name="services" className={styles.services}>
            <div className={styles["service-header"]}>
                <span className={styles.tag}>
                    Մեր ծառայությունները
                </span>

                <h2 className={styles.title}>
                    Ամբողջական լուծումներ մեկ թիմի կողմից
                </h2>

                <div className={styles.features}>
                    <span>✓ 100% անհատական մոտեցում</span>
                    <span>✓ Որակի վերահսկում յուրաքանչյուր փուլում</span>
                    <span>✓ Փորձառու մասնագետների թիմ</span>
                    <span>✓ Վստահելի գործընկեր</span>
                </div>
            </div>

            <div className={styles.cards}>
                <article className={styles.card}>
                    <svg className={styles.serviceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20 12 4l8 16H4Zm8-16v16M7 14h10" /></svg>
                    <h3>Գեոդեզիա և չափագրում</h3>
                    <p>Ճշգրիտ չափագրումներ և հողատարածքների ուսումնասիրություն։</p>
                    <a href="#contact">Մանրամասների համար կապ հաստատել <span aria-hidden="true">↗</span></a>
                </article>

                <article className={styles.card}>
                    <svg className={styles.serviceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 21V6h16v15M8 10h2m4 0h2M8 14h2m4 0h2M10 21v-3h4v3" /></svg>
                    <h3>Կառուցապատում</h3>
                    <p>Բնակելի և կոմերցիոն նախագծերի իրականացում։</p>
                    <a href="#contact">Մանրամասների համար կապ հաստատել <span aria-hidden="true">↗</span></a>
                </article>

                <article className={styles.card}>
                    <svg className={styles.serviceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h16M6 17 17 6l3 3L9 20H6v-3Zm9-9 3 3" /></svg>
                    <h3>Նախագծում</h3>
                    <p>Ճարտարապետական և ինժեներական նախագծեր։</p>
                    <a href="#contact">Մանրամասների համար կապ հաստատել <span aria-hidden="true">↗</span></a>
                </article>

                <article className={styles.card}>
                    <svg className={styles.serviceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4M3 10v8h18v-8M3 14h18M5 18v3m14-3v3" /></svg>
                    <h3>Կահույք</h3>
                    <p>Անհատական նախագծմամբ կահույքի արտադրություն։</p>
                    <a href="#contact">Մանրամասների համար կապ հաստատել <span aria-hidden="true">↗</span></a>
                </article>

                <article className={styles.card}>
                    <svg className={styles.serviceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 3h18v18H3V3Zm9 0v18M3 12h18" /></svg>
                    <h3>Դռներ և պատուհաններ</h3>
                    <p>Մետաղապլաստե և միջսենյակային լուծումներ։</p>
                    <a href="#contact">Մանրամասների համար կապ հաստատել <span aria-hidden="true">↗</span></a>
                </article>

                <article className={styles.card}>
                    <svg className={styles.serviceIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 11 12 3l9 8M5 10v11h14V10M10 21v-7h4v7" /></svg>
                    <h3>Անշարժ գույք</h3>
                    <p>Գնահատում, խորհրդատվություն և գույքային ծառայություններ։</p>
                    <a href="#contact">Մանրամասների համար կապ հաստատել <span aria-hidden="true">↗</span></a>
                </article>
            </div>
            
        </section>
    )
}