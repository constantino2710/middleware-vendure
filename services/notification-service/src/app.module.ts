// Módulo do consumer.
//
// @Module({
//   imports: [
//     ConfigModule.forRoot({ isGlobal: true }),
//     LoggerModule.forRoot(),
//     RabbitMQModule.forRoot({
//       exchanges: [{ name: 'orders.events', type: 'topic' }],
//       uri: process.env.RABBITMQ_URL!,
//     }),
//   ],
//   providers: [NotificationConsumer],
// })
// export class AppModule {}
