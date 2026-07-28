
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
                <div className={styles.card}>
                    <h3>📐 Գեոդեզիա և չափագրում</h3>
                    <p>Ճշգրիտ չափագրումներ և հողատարածքների ուսումնասիրություն։</p>
                </div>

                <div className={styles.card}>
                    <h3>🏗️ Կառուցապատում</h3>
                    <p>Բնակելի և կոմերցիոն նախագծերի իրականացում։</p>
                </div>

                <div className={styles.card}>
                    <h3>📋 Նախագծում</h3>
                    <p>Ճարտարապետական և ինժեներական նախագծեր։</p>
                </div>

                <div className={styles.card}>
                    <h3>🛋️ Կահույք</h3>
                    <p>Անհատական նախագծմամբ կահույքի արտադրություն։</p>
                </div>

                <div className={styles.card}>
                    <h3>🚪 Դռներ և պատուհաններ</h3>
                    <p>Մետաղապլաստե և միջսենյակային լուծումներ։</p>
                </div>

                <div className={styles.card}>
                    <h3>🏠 Անշարժ գույք</h3>
                    <p>Գնահատում, խորհրդատվություն և գույքային ծառայություններ։</p>
                </div>
            </div>
            
        </section>
    )
}