// src/utils/migrations.ts

import db from '../db'; // Asegúrate de que esta ruta sea correcta para tu archivo de conexión a la base de datos

export async function runMigrations() {
    try {
        console.log('Iniciando migraciones de base de datos...');

        // Información de la tabla para verificar columnas existentes
        const tableInfo = db.prepare("PRAGMA table_info(accounts);").all() as { name: string }[];
        const hasRankTier = tableInfo.some(col => col.name === 'rankTier');
        const hasRankSoloQ = tableInfo.some(col => col.name === 'rankSoloQ');
        const hasRankFlex = tableInfo.some(col => col.name === 'rankFlex');
        const hasRankTFT = tableInfo.some(col => col.name === 'rankTFT');

        // Paso 1: Renombrar 'rankTier' a 'rankSoloQ' si 'rankTier' existe y 'rankSoloQ' no
        if (hasRankTier && !hasRankSoloQ) {
            console.log("Renombrando columna 'rankTier' a 'rankSoloQ'...");
            db.prepare(`ALTER TABLE accounts RENAME COLUMN rankTier TO rankSoloQ;`).run();
            console.log("'rankTier' renombrada a 'rankSoloQ'.");
        } else if (!hasRankTier && !hasRankSoloQ) {
            // Si ninguna existe, se añade 'rankSoloQ' en el siguiente paso
            console.log("Ni 'rankTier' ni 'rankSoloQ' existen. Se añadirá 'rankSoloQ'.");
        } else if (hasRankTier && hasRankSoloQ) {
            console.log("Ambas columnas 'rankTier' y 'rankSoloQ' existen. Asegúrate de que 'rankTier' ya no se usa.");
            // Aquí podrías decidir eliminar 'rankTier' si estás seguro de que 'rankSoloQ' ya tiene los datos correctos
            // db.prepare(`ALTER TABLE accounts DROP COLUMN rankTier;`).run();
        }


        // Paso 2: Añadir 'rankSoloQ' si no existe (por si la tabla era completamente nueva o no tenía rangos)
        if (!hasRankSoloQ) {
            console.log("Añadiendo columna 'rankSoloQ' a la tabla 'accounts'...");
            db.prepare(`ALTER TABLE accounts ADD COLUMN rankSoloQ TEXT DEFAULT 'UNRANKED';`).run();
            console.log("'rankSoloQ' añadida.");
        } else {
            console.log("'rankSoloQ' ya existe.");
        }

        // Paso 3: Añadir 'rankFlex' si no existe
        if (!hasRankFlex) {
            console.log("Añadiendo columna 'rankFlex' a la tabla 'accounts'...");
            db.prepare(`ALTER TABLE accounts ADD COLUMN rankFlex TEXT DEFAULT 'UNRANKED';`).run();
            console.log("'rankFlex' añadida.");
        } else {
            console.log("'rankFlex' ya existe.");
        }

        // Paso 4: Añadir 'rankTFT' si no existe
        if (!hasRankTFT) {
            console.log("Añadiendo columna 'rankTFT' a la tabla 'accounts'...");
            db.prepare(`ALTER TABLE accounts ADD COLUMN rankTFT TEXT DEFAULT 'UNRANKED';`).run();
            console.log("'rankTFT' añadida.");
        } else {
            console.log("'rankTFT' ya existe.");
        }

        console.log('Migraciones de base de datos completadas.');
    } catch (error) {
        console.error('❌ Error durante las migraciones de base de datos:', error);
    }
}