-- Executado pelo PostgreSQL apenas na PRIMEIRA criação do volume.
-- Cria um banco separado para os testes automatizados (npm run test:db),
-- que é limpo a cada execução e nunca mistura dados com o ranking real.
CREATE DATABASE corrida_dos_dois_test;
