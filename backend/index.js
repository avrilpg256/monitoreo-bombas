import express from 'express';
import path from 'path';
const app = express();
const PORT = 3000;
import pkg from 'pg';
const { Pool } = pkg;

const pool= new Pool({
  connectionString: 'postgresql://Historial_owner:npg_zmi7Fvn6yasV@ep-frosty-snowflake-a8xovjxz-pooler.eastus2.azure.neon.tech/Historial?sslmode=require', 
  ssl:{
    rejectUnauthorized: false
  }
  });
  pool.connect()
  .then(() => {
    console.log("Conexión exitosa a la base de datos Neon");
  })
  .catch((err) => {
    console.error(" Error al conectar con la base de datos:", err);
  });
  export default pool;

app.use(express.static(path.join('frontend')));
app.use(express.json());
app.use(express.static('public'));



const TELEGRAM_BOT_TOKEN = '7574833745:AAG0H-HV4ij1zMe9SlR-mgo1Fn39Y55g4U8';
const CHAT_ID = ['7076310110', '6462581956'];

export async function enviarAlerta(mensaje) {
  for (const id of CHAT_ID) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    await fetch(url, {
      method: 'POST',
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: id,
        text: mensaje
      }),
    });
  }
}



async function registrarHistorial(temperatura, vibracion) {
  let estado = 'Normal';

  if (temperatura > 35 && vibracion === 0) {
    estado = 'Crítico';
  } else if ((temperatura > 35 && vibracion === 1) || (temperatura <= 35 && vibracion === 0)) {
    estado = 'Advertencia';
  }

  try {
    await pool.query(
      'INSERT INTO historial (temperatura, vibracion, estado) VALUES ($1, $2, $3)',
      [temperatura, vibracion, estado]
    );
    console.log("Historial combinado guardado");
  } catch (error) {
    console.error("Error al guardar historial combinado:", error);
  }
}


let temperaturaActual = null;
let lecturas = [];

app.post('/temperatura', async (req, res) => {
  const { temperatura } = req.body;
  const temp = parseFloat(temperatura);
  console.log("Temperatura recibidaaaa");

  temperaturaActual = temp;
  lecturas.push(temp);
  res.sendStatus(200);
});

setInterval(async () => {
  if (lecturas.length === 0) return;
  const suma = lecturas.reduce((a, b) => a + b, 0);
  const promedio = suma / lecturas.length;
 try {
    await pool.query('INSERT INTO temperatura(valor) VALUES($1)', [promedio]);
    console.log("promedio listo");
    await registrarHistorial(promedio, parseInt(ultimaVibracion?.vibracion || 0));

      if (promedio > 35) {
     await enviarAlerta(`🚨 Alerta: Temperatura alta detectada (${promedio.toFixed(1)}°C) en la bomba.`);
    }

  } catch (error) {
    console.error('Error al guardar el promedio:', error);
  }
  lecturas = [];
}, 30_000);
 
app.get('/historial-temperatura', async (req, res) => {
  try {
    const result = await pool.query(`SELECT valor, TO_CHAR(fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago', 'DD-MM-YYYY HH24:MI:SS') AS fecha FROM temperatura ORDER BY fecha DESC`); 
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).send('Error al obtener historial');
  }
});

app.get('/api/temperatura', (req, res) => {
  res.json({ temperatura: temperaturaActual });
});

app.get('/api/historial-estado', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        temperatura,
        vibracion,
        estado,
        TO_CHAR(
          fecha AT TIME ZONE 'UTC' AT TIME ZONE 'America/Santiago',
          'DD-MM-YYYY HH24:MI:SS'
        ) AS fecha
      FROM historial
      ORDER BY fecha DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener historial combinado:', error);
    res.status(500).send('Error al obtener historial');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.resolve('frontend', 'inicio.html'));
});

app.get('/historial', (req, res) => {
  res.sendFile(path.resolve('frontend', 'historial.html'));
});

app.get('/temperatura', (req, res) => {
  res.sendFile(path.resolve( 'frontend', 'temperatura.html'));
});

app.get('/vibracion', async(req, res) => {
  res.sendFile(path.resolve('frontend', 'vibracion.html'));
});

let ultimaVibracion = null;

app.post('/api/vibracion', async (req, res) => {
  const { vibracion } = req.body;
  ultimaVibracion = {
    vibracion,
    timestamp: new Date().toISOString()
  };

  console.log("Vibración detectada:", ultimaVibracion);


  try {
    await pool.query(
      'INSERT INTO vibracion(estado) VALUES($1)', 
      [vibracion]
    );
    console.log("Registro de vibración insertado correctamente");
    if (parseInt(vibracion) === 0) {
      await enviarAlerta('🚨 ¡Alerta! La bomba ha dejado de vibrar. Revisa su funcionamiento.');
    }
  } catch (error) {
    console.error("Error al guardar vibración en BD:", error);
    return res.status(500).json({ error: "No se pudo guardar en base de datos" });
  }

  res.sendStatus(200);
});

app.get('/api/estado-vibracion', (req, res) => {
  res.json(ultimaVibracion || { vibracion: false, timestamp: null });
});

app.get('/historial-vibracion', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        estado, 
        TO_CHAR(
          fecha AT TIME ZONE 'UTC' 
          AT TIME ZONE 'America/Santiago', 
          'DD-MM-YYYY HH24:MI:SS'
        ) AS fecha_formateada 
      FROM vibracion 
      ORDER BY fecha DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener historial de vibración:', error);
    res.status(500).send('Error al obtener historial de vibración');
}
});


app.listen(3000, '0.0.0.0', () => {
  console.log("Servidor escuchandooooo en puerto 3000");
});
