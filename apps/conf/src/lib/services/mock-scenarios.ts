import type { MockScenario } from '../types';

export const MOCK_SCENARIOS: MockScenario[] = [
    {
        id: 'fop',
        label: 'ФОП ДМИТРИШЕН',
        sublabel: 'Основний бізнес-рахунок (А-Банк)',
        badge: 'ФОП',
        color: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
        version: '003',
        data: {
            recipient: 'ФОП ДМИТРИШЕН',
            iban: 'UA12345678987654321345562',
            amount: '11.00',
            recipientCode: '11212121212',
            purpose: 'Оплата за товари/послуги згідно рахунку RHK-2026-001056 від 05.09.2026, у т.ч. ПДВ.',
            function: 'ICT',
            isoCategory: 'OTHR',
            isoPurpose: 'GDDS',
            reference: 'RHK-2026-001056',
            display: '?<InstrForCdtrAgt><InstrInf>MerchID:01234-TermID:43210</InstrInf></InstrForCdtrAgt>',
            lockFields: 'FFFF',
            validUntil: '260912235959'
        }
    },
    {
        id: 'rozetka',
        label: 'Rozetka',
        sublabel: 'Інтернет-магазин (ЕВО, v003)',
        badge: 'E-COMM',
        color: 'from-purple-500/20 to-indigo-500/20 text-purple-400 border-purple-500/30',
        version: '003',
        data: {
            recipient: 'ТОВ «ФК „ЕВО“»',
            iban: 'UA673005280000026500504354077',
            amount: '150.00',
            recipientCode: '37193071',
            purpose: 'Покупка товарів, замовлення №821558965',
            function: 'ICT',
            isoCategory: 'OTHR',
            isoPurpose: 'GDDS',
            reference: '1225102576',
            display: '?<InstrForCdtrAgt><InstrInf>MerchID:01234-TermId:43210</InstrInf></InstrForCdtrAgt>',
            lockFields: 'FFFF',
            validUntil: ''
        }
    },
    {
        id: 'silpo',
        label: 'Сільпо',
        sublabel: 'Роздрібний супермаркет (v003)',
        badge: 'RETAIL',
        color: 'from-pink-500/20 to-rose-500/20 text-pink-400 border-pink-500/30',
        version: '003',
        data: {
            recipient: 'ТОВ "Сільпо-Фуд"',
            iban: 'UA133071230000026006010423515',
            amount: '1240.50',
            recipientCode: '40720198',
            purpose: 'Покупка товарів, №148/720/501',
            function: 'ICT',
            isoCategory: 'MP2B',
            isoPurpose: 'GSCB',
            reference: 'CHK-1234',
            display: '?<InstrForCdtrAgt><InstrInf>s148-p720</InstrInf></InstrForCdtrAgt>',
            lockFields: 'FFFF',
            validUntil: '260301120000'
        }
    },
    {
        id: 'p2p',
        label: 'Кава / P2P',
        sublabel: 'Особистий переказ (v003)',
        badge: 'P2P',
        color: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
        version: '003',
        data: {
            recipient: 'Петренко Роман',
            iban: 'UA906543210000000260323012024',
            amount: '65.00',
            recipientCode: '40121425',
            purpose: 'За каву',
            function: 'ICT',
            isoCategory: 'MP2P',
            isoPurpose: 'MP2B',
            reference: 'DR-5678-12',
            display: '?<UltmtCdtr><Nm>Іванов Іван</Nm></UltmtCdtr>',
            lockFields: 'FEFF',
            validUntil: '261231235959'
        }
    },
    {
        id: 'dentist',
        label: 'Стоматолог',
        sublabel: 'Медичні послуги (v002)',
        badge: 'SERVICE',
        color: 'from-teal-500/20 to-cyan-500/20 text-teal-400 border-teal-500/30',
        version: '002',
        data: {
            recipient: 'ТОВ «Стоматологія»',
            iban: 'UA783226690000026005012107358',
            amount: '1034.28',
            recipientCode: '40723824',
            purpose: 'Стоматологічні послуги',
            function: 'UCT',
            isoCategory: 'OTHR',
            isoPurpose: 'OTHR',
            reference: '',
            display: '',
            lockFields: '',
            validUntil: ''
        }
    },
    {
        id: 'utility',
        label: 'Комуналка',
        sublabel: 'Водопостачання (v001/v002)',
        badge: 'UTILITY',
        color: 'from-blue-500/20 to-sky-500/20 text-blue-400 border-blue-500/30',
        version: '002',
        data: {
            recipient: 'ПрАТ АК «Водопостачання»',
            iban: 'UA783226690000026005012107132',
            amount: '576.45',
            recipientCode: '40723825',
            purpose: 'Оплата за лютий 2026',
            function: 'UCT',
            isoCategory: 'OTHR',
            isoPurpose: 'OTHR',
            reference: '',
            display: '',
            lockFields: '',
            validUntil: ''
        }
    }
];
