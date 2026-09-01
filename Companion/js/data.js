/**
 * EMS Companion - Default Datasets & Static Content
 */

export const DEFAULT_DISCORD_SERVER_ID = '1035903890996080811';

export const DEFAULT_DISCORD_CHANNELS = {
    bodycam: '1035903894049542188',
    codea: '1035903894049542185',
    break: '1035903894049542184',
    supplies: '1035903894049542186',
    rota: '1081157781530357771',
    captcha: '1151594608460038245',
    deliveries: '1035903894049542187',
    radiocodes: '1035903894552850452',
    replacementlogs: '1035903893772710037'
};

export const DEFAULT_SHIFT_RATES = {
    nightPH: 25000,
    nightSH: 40000,
    nightCalls: 20000,
    dayPH: 10000,
    daySH: 30000,
    dayCalls: 15000,
    labCaptcha: 5000,
    labMedicine: 10000
};

export const ALL_DUTY_STEPS = [
    'od1', 'od2', 'od3',
    'ref1', 'ref2',
    'sav1', 'sav2',
    'off1', 'off2', 'off3',
    'sw1_1', 'sw1_2', 'sw1_3', 'sw1_4', 'sw1_5',
    'sw2_1', 'sw2_2', 'sw2_3', 'sw2_4', 'sw2_5',
    'sw3_1', 'sw3_2', 'sw3_3', 'sw3_4', 'sw3_5'
];

export const STEP_DEPENDENCIES = [
    ['od1', 'od2'], ['od2', 'od3'],
    ['ref1', 'ref2'],
    ['sav1', 'sav2'],
    ['off1', 'off2'], ['off2', 'off3'],
    ['sw1_1', 'sw1_2'], ['sw1_2', 'sw1_3'], ['sw1_3', 'sw1_4'], ['sw1_4', 'sw1_5'],
    ['sw2_1', 'sw2_2'], ['sw2_2', 'sw2_3'], ['sw2_3', 'sw2_4'], ['sw2_4', 'sw2_5'],
    ['sw3_1', 'sw3_2'], ['sw3_2', 'sw3_3'], ['sw3_3', 'sw3_4'], ['sw3_4', 'sw3_5']
];

export const BOTTOM_NAV_SERVICES = [
    { id: 'hs', icon: '🏥', text: 'HOSPITAL<br>SERVICES', smallText: 'HOSPITAL<br>SERVICES', modal: 'modal-hs' },
    { id: 'gs', icon: '🚑', text: 'GROUND<br>SERVICES', smallText: 'GROUND<br>SERVICES', modal: 'modal-gs' },
    { id: 'labtech', icon: '🔬', text: 'LABTECH', smallText: 'LABTECH', modal: 'modal-discord' }
];

export const QUICK_CODES = [
    { code: '10-4', label: '10-4<br>(Affirmative)', text: '10-4' },
    { code: '10-2', label: '10-2<br>(Negative)', text: '10-2' },
    { code: '10-20', label: '10-20<br>(Full command)', text: 'Can I get a 10-20 from ALL Active Units?' },
    { code: '10-6', label: '10-6<br>(Ignore Last)', text: '10-6' },
    { code: '10-17', label: '10-17<br>(Full command)', text: '10-17 [A to B] ///XXX +1 units' }
];
